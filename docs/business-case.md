# Business case: Nusantara Smart Devices

A distributor and light assembler of consumer electronics runs a head office in Jakarta and warehouses in Surabaya and Bandung. The demo data models six months of its trade.

## Problems the system solves

| Problem | How AetherERP addresses it |
| --- | --- |
| Stock and books disagree at month end | Every stock movement posts a journal in the same transaction; a test asserts GL inventory equals the FIFO layer value. |
| Margins look healthy but are not | FIFO costing means COGS reflects the price actually paid for the oldest stock. |
| Large purchases approved by the person who raised them | Orders above the threshold need a different approver (segregation of duties). |
| Overselling during busy periods | Stock is reserved at confirmation with an atomic guard. |
| Customers exceed their credit | Confirmation is rejected when open receivables plus the new order exceed the limit. |
| Cannot prove who changed what | Append-only audit log with before/after values; posted journals cannot be edited. |
| Branch visibility | Every report and the dashboard switch between one branch and the consolidated company. |

## Walkthrough for a demo

1. Sign in as `buyer@aether.local`, create a purchase order above Rp50.000.000 and submit it. It waits for approval.
2. Sign in as `procurement@aether.local` and approve it. The creator cannot approve their own order.
3. As `warehouse@aether.local`, receive the goods. A FIFO layer and a journal appear.
4. Complete an assembly work order and read its actual unit cost.
5. As `sales@aether.local`, create and confirm a sales order for more than the available stock; it is refused.
6. Deliver, invoice and pay a valid order. Open Financial reports: the trial balance and balance sheet stay balanced.
7. As `auditor@aether.local`, open the audit log.
