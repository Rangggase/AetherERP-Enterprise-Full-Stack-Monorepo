"""Multi-warehouse stock engine with FIFO cost layers.

Stock mutations use guarded single-statement UPDATEs so that concurrent transactions can
never drive on-hand or available quantity below zero (no overselling).
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.errors import Conflict, DomainError, NotFound
from app.models import (
    BillOfMaterials,
    Product,
    StockBalance,
    StockBatch,
    StockCount,
    StockCountItem,
    StockMovement,
    StockTransfer,
    StockTransferItem,
    WorkOrder,
)
from app.models.base import ZERO, money, qty as q4, utcnow
from app.services import ledger
from app.services.numbering import next_number

INVENTORY_ACCOUNT = {"RAW_MATERIAL": "1310", "FINISHED_GOOD": "1300"}
SHRINKAGE_ACCOUNT = "6900"
GAIN_ACCOUNT = "4200"


def inventory_account(product: Product) -> str:
    return INVENTORY_ACCOUNT.get(product.product_type, "1300")


def _stocked_product(db: Session, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if p is None:
        raise NotFound(f"Product {product_id} not found")
    if not p.is_stocked:
        raise DomainError(f"{p.sku} is a service and has no stock")
    return p


def ensure_balance(db: Session, branch_id: int, product_id: int) -> StockBalance:
    bal = db.execute(
        select(StockBalance).where(StockBalance.branch_id == branch_id, StockBalance.product_id == product_id)
    ).scalar_one_or_none()
    if bal is None:
        bal = StockBalance(branch_id=branch_id, product_id=product_id, on_hand=ZERO, reserved=ZERO)
        db.add(bal)
        db.flush()
    return bal


def _balance_update(db: Session, branch_id: int, product_id: int, *, on_hand=ZERO, reserved=ZERO, guard) -> None:
    """Apply deltas atomically; `guard` is a SQL condition that must hold, else Conflict."""
    ensure_balance(db, branch_id, product_id)
    res = db.execute(
        update(StockBalance)
        .where(StockBalance.branch_id == branch_id, StockBalance.product_id == product_id, guard)
        .values(on_hand=StockBalance.on_hand + on_hand, reserved=StockBalance.reserved + reserved, updated_at=utcnow())
        .execution_options(synchronize_session=False)
    )
    if res.rowcount != 1:
        raise Conflict("Insufficient stock")


def available(db: Session, branch_id: int, product_id: int) -> Decimal:
    row = db.execute(
        select(StockBalance.on_hand - StockBalance.reserved).where(
            StockBalance.branch_id == branch_id, StockBalance.product_id == product_id
        )
    ).scalar_one_or_none()
    return q4(row or 0)


def _move(db, *, branch_id, product_id, mtype, quantity, unit_cost, batch_id, ref_type, ref_id, user_id) -> None:
    db.add(
        StockMovement(
            branch_id=branch_id,
            product_id=product_id,
            movement_type=mtype,
            quantity=quantity,
            unit_cost=unit_cost,
            batch_id=batch_id,
            ref_type=ref_type,
            ref_id=ref_id,
            created_by=user_id,
        )
    )


def receive_stock(
    db: Session,
    *,
    branch_id: int,
    product_id: int,
    quantity: Decimal,
    unit_cost: Decimal,
    mtype: str,
    ref_type: str | None = None,
    ref_id: int | None = None,
    user_id: int | None = None,
    received_at: datetime | None = None,
) -> StockBatch:
    quantity = q4(quantity)
    if quantity <= 0:
        raise DomainError("Quantity must be positive")
    _stocked_product(db, product_id)
    _balance_update(db, branch_id, product_id, on_hand=quantity, guard=StockBalance.on_hand >= 0)
    batch = StockBatch(
        branch_id=branch_id,
        product_id=product_id,
        received_at=received_at or utcnow(),
        unit_cost=q4(unit_cost),
        qty_received=quantity,
        qty_remaining=quantity,
        source_type=ref_type,
        source_id=ref_id,
    )
    db.add(batch)
    db.flush()
    _move(db, branch_id=branch_id, product_id=product_id, mtype=mtype, quantity=quantity,
          unit_cost=batch.unit_cost, batch_id=batch.id, ref_type=ref_type, ref_id=ref_id, user_id=user_id)
    return batch


def reserve(db: Session, branch_id: int, product_id: int, quantity: Decimal) -> None:
    quantity = q4(quantity)
    _balance_update(
        db, branch_id, product_id, reserved=quantity,
        guard=(StockBalance.on_hand - StockBalance.reserved) >= quantity,
    )


def release(db: Session, branch_id: int, product_id: int, quantity: Decimal) -> None:
    quantity = q4(quantity)
    _balance_update(db, branch_id, product_id, reserved=-quantity, guard=StockBalance.reserved >= quantity)


def consume_fifo(
    db: Session,
    *,
    branch_id: int,
    product_id: int,
    quantity: Decimal,
    mtype: str,
    ref_type: str | None = None,
    ref_id: int | None = None,
    user_id: int | None = None,
    from_reserved: bool = False,
) -> tuple[Decimal, list[dict]]:
    """Issue stock oldest-layer-first. Returns (total cost rounded to cents, consumed layers)."""
    quantity = q4(quantity)
    if quantity <= 0:
        raise DomainError("Quantity must be positive")
    _stocked_product(db, product_id)
    if from_reserved:
        _balance_update(db, branch_id, product_id, on_hand=-quantity, reserved=-quantity,
                        guard=(StockBalance.reserved >= quantity) & (StockBalance.on_hand >= quantity))
    else:
        _balance_update(db, branch_id, product_id, on_hand=-quantity,
                        guard=(StockBalance.on_hand - StockBalance.reserved) >= quantity)

    batches = db.execute(
        select(StockBatch)
        .where(StockBatch.branch_id == branch_id, StockBatch.product_id == product_id, StockBatch.qty_remaining > 0)
        .order_by(StockBatch.received_at, StockBatch.id)
        .with_for_update()
    ).scalars().all()
    need = quantity
    total = ZERO
    layers: list[dict] = []
    for b in batches:
        if need <= 0:
            break
        take = min(b.qty_remaining, need)
        b.qty_remaining = q4(b.qty_remaining - take)
        total += take * b.unit_cost
        layers.append({"qty": str(take), "unit_cost": str(b.unit_cost), "received_at": b.received_at.isoformat()})
        _move(db, branch_id=branch_id, product_id=product_id, mtype=mtype, quantity=-take,
              unit_cost=b.unit_cost, batch_id=b.id, ref_type=ref_type, ref_id=ref_id, user_id=user_id)
        need -= take
    if need > 0:
        # Balances and layers drifted apart: fail loudly rather than costing stock at zero.
        raise Conflict("FIFO layers are inconsistent with the stock balance")
    db.flush()
    return money(total), layers


def stock_value(db: Session, branch_id: int | None = None) -> Decimal:
    q = select(func.coalesce(func.sum(StockBatch.qty_remaining * StockBatch.unit_cost), 0))
    if branch_id:
        q = q.where(StockBatch.branch_id == branch_id)
    return money(db.execute(q).scalar_one())


# --------------------------------------------------------------------------- transfers


def create_transfer(db: Session, *, from_branch_id: int, to_branch_id: int, items: list[tuple[int, Decimal]], user_id) -> StockTransfer:
    if from_branch_id == to_branch_id:
        raise DomainError("Source and destination must differ")
    if not items:
        raise DomainError("A transfer needs at least one item")
    for pid, quantity in items:
        _stocked_product(db, pid)
        if q4(quantity) <= 0:
            raise DomainError("Quantity must be positive")
    t = StockTransfer(
        transfer_no=next_number(db, "TR"), from_branch_id=from_branch_id, to_branch_id=to_branch_id,
        status="REQUESTED", created_by=user_id,
    )
    t.items = [StockTransferItem(product_id=p, quantity=q4(n)) for p, n in items]
    db.add(t)
    db.flush()
    return t


def dispatch_transfer(db: Session, transfer_id: int, user_id) -> StockTransfer:
    t = db.get(StockTransfer, transfer_id)
    if t is None:
        raise NotFound("Transfer not found")
    if t.status != "REQUESTED":
        raise Conflict(f"Transfer is {t.status}")
    for item in t.items:
        _, layers = consume_fifo(db, branch_id=t.from_branch_id, product_id=item.product_id, quantity=item.quantity,
                                 mtype="TRANSFER_OUT", ref_type="TRANSFER", ref_id=t.id, user_id=user_id)
        item.layers = layers
    t.status = "IN_TRANSIT"
    db.flush()
    return t


def receive_transfer(db: Session, transfer_id: int, user_id) -> StockTransfer:
    t = db.get(StockTransfer, transfer_id)
    if t is None:
        raise NotFound("Transfer not found")
    if t.status != "IN_TRANSIT":
        raise Conflict(f"Transfer is {t.status}")
    for item in t.items:
        for layer in item.layers or []:
            receive_stock(db, branch_id=t.to_branch_id, product_id=item.product_id, quantity=Decimal(layer["qty"]),
                          unit_cost=Decimal(layer["unit_cost"]), mtype="TRANSFER_IN", ref_type="TRANSFER",
                          ref_id=t.id, user_id=user_id, received_at=datetime.fromisoformat(layer["received_at"]))
    t.status = "RECEIVED"
    db.flush()
    return t


# --------------------------------------------------------------------------- assembly


def create_work_order(db: Session, *, branch_id: int, product_id: int, quantity: Decimal, user_id) -> WorkOrder:
    bom = db.execute(select(BillOfMaterials).where(BillOfMaterials.product_id == product_id, BillOfMaterials.is_active)).scalar_one_or_none()
    if bom is None:
        raise DomainError("No active BOM for this product")
    wo = WorkOrder(wo_no=next_number(db, "WO"), branch_id=branch_id, product_id=product_id,
                   quantity=q4(quantity), status="DRAFT", created_by=user_id)
    db.add(wo)
    db.flush()
    return wo


def complete_work_order(db: Session, wo_id: int, user_id) -> WorkOrder:
    wo = db.get(WorkOrder, wo_id)
    if wo is None:
        raise NotFound("Work order not found")
    if wo.status != "DRAFT":
        raise Conflict(f"Work order is {wo.status}")
    bom = db.execute(select(BillOfMaterials).where(BillOfMaterials.product_id == wo.product_id)).scalar_one()
    batches_factor = q4(wo.quantity / bom.output_qty)
    total = ZERO
    credits: dict[str, Decimal] = {}
    for comp in bom.items:
        need = q4(comp.quantity * batches_factor)
        cost, _ = consume_fifo(db, branch_id=wo.branch_id, product_id=comp.component_id, quantity=need,
                               mtype="WO_CONSUME", ref_type="WORK_ORDER", ref_id=wo.id, user_id=user_id)
        acct = inventory_account(comp.component)
        credits[acct] = credits.get(acct, ZERO) + cost
        total += cost
    unit_cost = q4(total / wo.quantity)
    receive_stock(db, branch_id=wo.branch_id, product_id=wo.product_id, quantity=wo.quantity, unit_cost=unit_cost,
                  mtype="WO_OUTPUT", ref_type="WORK_ORDER", ref_id=wo.id, user_id=user_id)
    fg_account = inventory_account(bom.product)
    lines = [ledger.debit(fg_account, total, f"Output {wo.wo_no}")] + [
        ledger.credit(a, v, f"Consumption {wo.wo_no}") for a, v in credits.items()
    ]
    je = ledger.post_entry(db, entry_date=date.today(), branch_id=wo.branch_id, description=f"Assembly {wo.wo_no}",
                           lines=lines, source_type="WORK_ORDER", source_id=wo.id, user_id=user_id)
    wo.total_cost, wo.unit_cost, wo.status = money(total), unit_cost, "COMPLETED"
    wo.completed_at = utcnow()
    wo.journal_entry_id = je.id
    db.flush()
    return wo


# --------------------------------------------------------------------------- stock opname


def create_count(db: Session, *, branch_id: int, count_date: date, counted: list[tuple[int, Decimal]], user_id) -> StockCount:
    if not counted:
        raise DomainError("A count needs at least one product")
    sc = StockCount(count_no=next_number(db, "SO-CNT", count_date), branch_id=branch_id, count_date=count_date,
                    status="DRAFT", created_by=user_id)
    for pid, counted_qty in counted:
        _stocked_product(db, pid)
        system = ensure_balance(db, branch_id, pid).on_hand
        sc.items.append(StockCountItem(product_id=pid, system_qty=system, counted_qty=q4(counted_qty),
                                       variance_qty=q4(counted_qty) - system))
    db.add(sc)
    db.flush()
    return sc


def post_count(db: Session, count_id: int, user_id) -> StockCount:
    sc = db.get(StockCount, count_id)
    if sc is None:
        raise NotFound("Stock count not found")
    if sc.status != "DRAFT":
        raise Conflict("Stock count already posted")
    gain: dict[str, Decimal] = {}
    loss: dict[str, Decimal] = {}
    for item in sc.items:
        product = db.get(Product, item.product_id)
        # Re-read the system quantity: stock may have moved since the count sheet was drafted.
        system = ensure_balance(db, sc.branch_id, item.product_id).on_hand
        item.system_qty = system
        item.variance_qty = q4(item.counted_qty - system)
        acct = inventory_account(product)
        if item.variance_qty < 0:
            cost, _ = consume_fifo(db, branch_id=sc.branch_id, product_id=item.product_id, quantity=-item.variance_qty,
                                   mtype="COUNT_LOSS", ref_type="STOCK_COUNT", ref_id=sc.id, user_id=user_id)
            item.variance_value = -cost
            loss[acct] = loss.get(acct, ZERO) + cost
        elif item.variance_qty > 0:
            last = db.execute(
                select(StockBatch.unit_cost).where(StockBatch.branch_id == sc.branch_id, StockBatch.product_id == item.product_id)
                .order_by(StockBatch.received_at.desc(), StockBatch.id.desc()).limit(1)
            ).scalar_one_or_none()
            unit = last if last is not None else product.standard_cost
            receive_stock(db, branch_id=sc.branch_id, product_id=item.product_id, quantity=item.variance_qty,
                          unit_cost=unit, mtype="COUNT_GAIN", ref_type="STOCK_COUNT", ref_id=sc.id, user_id=user_id)
            value = money(item.variance_qty * q4(unit))
            item.variance_value = value
            gain[acct] = gain.get(acct, ZERO) + value
    lines = []
    for acct, v in loss.items():
        lines += [ledger.debit(SHRINKAGE_ACCOUNT, v, "Inventory shrinkage"), ledger.credit(acct, v, "Inventory shrinkage")]
    for acct, v in gain.items():
        lines += [ledger.debit(acct, v, "Inventory gain"), ledger.credit(GAIN_ACCOUNT, v, "Inventory gain")]
    if lines:
        je = ledger.post_entry(db, entry_date=sc.count_date, branch_id=sc.branch_id, description=f"Stock opname {sc.count_no}",
                               lines=lines, source_type="STOCK_COUNT", source_id=sc.id, user_id=user_id)
        sc.journal_entry_id = je.id
    sc.status = "POSTED"
    db.flush()
    return sc


# --------------------------------------------------------------------------- reorder


def reorder_recommendations(db: Session, branch_id: int | None = None, lookback_days: int = 30, lead_time_days: int = 7) -> list[dict]:
    """Suggest purchase quantities from average daily consumption over the lookback window."""
    from datetime import timedelta

    since = utcnow() - timedelta(days=lookback_days)
    usage_q = select(StockMovement.branch_id, StockMovement.product_id, func.sum(-StockMovement.quantity)).where(
        StockMovement.quantity < 0,
        StockMovement.movement_type.in_(("SALE", "WO_CONSUME")),
        StockMovement.created_at >= since,
    ).group_by(StockMovement.branch_id, StockMovement.product_id)
    usage = {(b, p): Decimal(u) for b, p, u in db.execute(usage_q)}
    bal_q = select(StockBalance, Product).join(Product, Product.id == StockBalance.product_id).where(Product.is_active)
    if branch_id:
        bal_q = bal_q.where(StockBalance.branch_id == branch_id)
    out = []
    for bal, p in db.execute(bal_q):
        avg_daily = q4(usage.get((bal.branch_id, bal.product_id), ZERO) / lookback_days)
        avail = bal.on_hand - bal.reserved
        dynamic_rop = q4(avg_daily * lead_time_days + p.safety_stock)
        threshold = max(dynamic_rop, p.reorder_point)
        if avail <= threshold:
            target = q4(avg_daily * (lead_time_days + lookback_days) + p.safety_stock)
            out.append({
                "branch_id": bal.branch_id, "product_id": p.id, "sku": p.sku, "name": p.name,
                "available": avail, "reorder_point": threshold, "avg_daily_usage": avg_daily,
                "suggested_order_qty": max(q4(target - avail), q4(p.reorder_point - avail), ZERO),
            })
    return sorted(out, key=lambda r: r["sku"])
