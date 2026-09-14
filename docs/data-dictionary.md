# Data dictionary

Schema verified against Supabase project `aaqquwhdglueqlnbifvn` on **2026-09-14**. The five reporting sources contain **94 physical columns**: `DriverPay` 26, `drivers` 17, `returns` 8, `settlements` 27, and `trucks` 16. The reporting system is single-organization; these source tables have RLS enabled. PostgreSQL column comments are currently absent; business semantics below come from the local Ninox field catalog, verified live schema/data, and confirmed business rules.

The authenticated `agent-reporting` metadata routes are the runtime contract. Call `?report=catalog` for the complete catalog or `?report=<name>&metadata=true` for one report.

## Shared rules

- Supabase identity `ID` columns are generated import-row keys, not Ninox record IDs.
- `as_of` is request time, not source-sync time. These source tables do not expose a reliable sync timestamp.
- **Relational fallback rule (approved business rule, 2026-09-11):** If a report needs an attribute not carried by its primary record, search the related approved-report sources by their designated business key before finalizing. CDL is the unique driver key for matching `drivers` and `DriverPay`; truck number is the vehicle key for matching field variants such as `truck_number`, `Truck_Number`, `Truck`, `truck_no`, and `unit_number`.
- Historical text truck keys must be normalized before comparing them to numeric `trucks.truck_number`. Use a **left join** from history because retired/historical truck numbers may not exist in the current master. Do not replace an absent CDL or truck key with a name or a Supabase `ID`.
- `DriverPay.DriversDB_ID` is text and joins to `drivers.Ninox_ID::text`; it remains available for legacy source linkage but CDL is the designated driver key for fallback lookups.
- `returns.Ninox_ID` is a Returns source-record ID, not a driver ID. `returns.CDL` is now available as a sensitive exact driver key; use it only when it matches a related approved record's verified CDL.

## `trucks` — current fleet master

**Grain:** one current master row per unique `truck_number`. `ID` is the primary key; `truck_number` has a unique constraint. Use this table for current facts only.

The settlement-only Truck 1/2/3 owner-expense allocation rule does not apply to this table. `Out Of Services` is a dispatcher value, but it is not equivalent to the exact Ninox in-yard/off-duty formula because Supabase lacks `days_in_yard_` and numeric insurance-choice fields.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `truck_number` | numeric | no | Unique current truck-master number. Ninox `E.A / truck_`. |
| `dispatcher` | text | yes | Current group/dispatcher. Current values include Group 1, Group 2, CDT, Solo, Out Of Services. Ninox `E.YF`. |
| `insurance` | text | yes | Current truck insurance/provider category. Use exact stored values. Ninox `E.Y4`. |
| `vin` | text | yes | Sensitive VIN. Ninox `E.CG`. |
| `make` | text | yes | Truck make/model display value. Ninox `E.DG`. |
| `odometer_miles` | numeric | yes | Current recorded odometer in miles. Ninox `E.OF`. |
| `owner` | text | yes | Current owner/entity; never use for historical settlement attribution. Ninox `E.VF`. |
| `last_known_address` | text | yes | Sensitive Samsara-derived last known address. Ninox `E.PF`. |
| `model_year` | numeric | yes | Vehicle model year. Ninox `E.IJ`. |
| `license_plate` | text | yes | Sensitive plate value. Ninox `E.HJ`. |
| `yard_location` | text | yes | Current selected/derived location such as 301 Yard or a service vendor. Ninox `E.X1`. |
| `samsara_last_connected_at` | timestamptz | yes | Last Samsara connection/report timestamp. Ninox `E.SF`. |
| `samsara_vehicle_id` | text | yes | Sensitive Samsara vehicle ID. Ninox `E.BM`. |
| `mechanic_status` | text | yes | Literal current shop status; blank/null means none stored. Ninox `E.TA`. |
| `ID` | bigint | no | Supabase identity primary key. |
| `Ninox_ID` | numeric | yes | Ninox TrucksDB source-record ID; it is not the canonical `truck_number`, and its broader business semantics are not established. |

## `DriverPay` — historical driver assignment/pay ledger

**Grain:** one driver assignment/pay record. Team trucks normally produce two rows, one per driver; a solo normally produces one row with `Solo_Driver_if_1 = 1`. Count distinct `Truck_Number` for truck totals.

Use `Out Date` alone for departures and `Return Date` alone for returns. For overlap with a settlement week: `Out Date <= settlements.To` and (`Return Date` is null or `Return Date >= settlements.From`), then inspect transfers/terminations inside that period.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `Truck_Number` | text | yes | Actual truck number from Ninox `WD.IA / TruckNumber_`. |
| `Out Date` | date | yes | Actual work departure date; use alone for departure questions. Ninox `WD.O`. |
| `Return Date` | date | yes | Historical return/rest/yard date; use alone for return questions. Ninox `WD.R`. |
| `Transfer` | text | yes | Transfer direction: To Other Truck or From Other Truck. Ninox `WD.I9`. |
| `DriversDB_ID` | text | yes | DriversDB ID; join to `drivers.Ninox_ID::text`. |
| `Termination` | text | yes | Early assignment-ending reason. Live values include Driver Changed/Fired; catalog also defines Early Broke Contract. Ninox `WD.LA`. |
| `Termination Date` | date | yes | Date this assignment ended for the termination reason. |
| `Transfer Date` | date | yes | Date of transfer. |
| `Transfer Truck` | text | yes | Destination for transfer-to; origin for transfer-from. |
| `Solo_Driver_if_1` | numeric | yes | `1` means solo. Null/other is not proof of exactly two rows; deduplicate trucks. Ninox `WD.PC`. |
| `MoneyPerWeekSigned` | numeric | yes | Fixed weekly salary. Ninox `WD.H6`. |
| `MoneyPerDaysigned` | numeric | yes | Stored daily rate; verified as weekly/7 in live rows. Ninox `WD.G6`. |
| `CPM` | numeric | yes | Per-mile rate above threshold. Ninox `WD.DA`. |
| `Pay CPM after Miles` | numeric | yes | Weekly mileage threshold. Ninox `WD.EA`. |
| `Driver Name` | text | yes | Driver display-name snapshot. |
| `First Name` | text | yes | First-name snapshot. |
| `Last Name` | text | yes | Last-name snapshot. |
| `E-mail` | text | yes | Sensitive email snapshot. |
| `Phone Number` | text | yes | Sensitive phone snapshot. |
| `CDL` | text | yes | Sensitive CDL snapshot. |
| `State` | text | yes | CDL issuing-state snapshot. |
| `owner` | text | yes | Historical assignment owner/entity. Ninox `WD.KB`. |
| `Samsara_ID` | text | yes | Sensitive Samsara vehicle ID. Ninox `WD.FB`. |
| `Dispatch_Name_` | text | yes | Historical assignment dispatch; history includes group labels and legacy names. Ninox `WD.ZA`. |
| `Temporal_Driver` | text | yes | Temporary-CDL indicator stored as Yes/No/null. Ninox `WD.UJ`. |
| `ID` | bigint | no | Supabase identity primary key; not Ninox DriverPay record ID. |

**Driver-pay calculation:** per driver assignment, `MoneyPerWeekSigned + CPM × max(Driven_miles − Pay CPM after Miles, 0)` for the matching settlement week. Do not divide team pay unless explicitly instructed.

## `drivers` — current driver master

**Grain:** one current profile. `ID` is the Supabase primary key; `Ninox_ID` is the unique source/business key. The local Ninox catalog has no field-level DriversDB/Z definitions, so label-based meanings below must not be expanded beyond what is established.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `FullName` | text | yes | Current full display name. |
| `First Name` | text | yes | Current first name. |
| `Middle Name` | text | yes | Current middle name. |
| `Last Name` | text | yes | Current last name. |
| `E-mail` | text | yes | Sensitive current email. |
| `Phone Number` | text | yes | Sensitive current phone. |
| `Years Of Experience` | numeric | yes | Ninox-calculated experience; use stored value unless asked to recalculate. |
| `DOB` | date | yes | Sensitive date of birth; validate anomalies before compliance use. |
| `Company Name (This is NOT the Insurance)` | text | yes | Employer/company; explicitly not insurance. |
| `CDL` | text | yes | Sensitive CDL number. |
| `State` | text | yes | CDL issuing state. |
| `CDL Expiration` | text | yes | Sensitive expiration value stored as text; validate format before date arithmetic. |
| `Gender` | text | yes | Sensitive gender value as stored; returned when `include_sensitive=true`. All agent API keys are allowed by default unless their matching `AGENT_ALLOW_SENSITIVE_<n>` control is set to `false`. |
| `Insurance` | text | yes | Driver-associated insurance/category code; code expansion is not established. |
| `Ninox_ID` | numeric | yes | Unique DriversDB source ID; preferred join key. |
| `ID` | bigint | no | Supabase identity primary key. |
| `Date of Hire` | date | yes | Current driver hire date. Physical type/column verified; source-field mapping and any employment-policy semantics are not established. |

## `returns` — current expected-return list

**Grain:** one returning driver/truck row. Team trucks normally have two rows. Count distinct `Truck` for truck totals. This is volatile current operational data; use DriverPay for history.

`Return Date` is a nullable PostgreSQL `date`, not a free-text status field. Filter with inclusive ISO dates. Supabase omits Ninox Returns fields `Solo`, `DriverDB_Id_saved`, and `Driver_id_Pay_`.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `Insurance` | text | yes | Insurance category/code; use literal value. |
| `Truck` | text | yes | Returning truck number. Ninox `S.A`. |
| `Driver Name` | text | yes | Driver display name. Ninox `S.B`. |
| `Phone Number` | text | yes | Sensitive phone. Ninox `S.E`. |
| `Return Date` | date | yes | Expected return date; null means no date stored. Ninox `S.H`. |
| `ID` | bigint | no | Supabase identity primary key. |
| `Ninox_ID` | numeric | yes | Returns source-record ID; **not** a driver ID. |
| `CDL` | text | yes | Sensitive commercial driver-license value. Use as an exact driver link only after confirming the same CDL in a related approved record. |

## `settlements` — weekly financial ledger

**Grain:** one truck identifier or owner bucket per Tuesday–Monday period. `(Truck, From, To)` is unique in verified live data. Attribute history using this row's `Owner` and `Dispatch`, never current truck-master values.

**Owner-expense allocation buckets (settlements only):** `Truck` 1=Carlos, 2=Jorge, 3=CDT. They are non-physical trucks. Each bucket holds its owner's total `truck_loans` and `Insurance` amounts that are not applied to a specific physical truck. Include these rows in the respective owner's general settlement totals, display them as non-physical owner-expense allocation buckets, and exclude them from physical-truck counts/rankings. Do not apply this classification to `trucks`, DriverPay, or returns.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `Truck` | text | yes | Physical truck number or settlement-only non-physical owner-expense allocation bucket. Ninox `DE.K`. |
| `truck_insurance` | text | yes | Period-specific truck insurance category/code. |
| `Dispatch` | text | yes | Historical dispatch value for this period. Ninox `DE.X3`. |
| `Owner` | text | yes | Historical owner/entity for this period. |
| `Gross` | numeric | yes | Stored total gross before percentage/expenses. Ninox `DE.L4`. |
| `tonu` | numeric | yes | Imported physical name for additional/Compass income already included in Gross; do not treat as tonnage quantity or add again. Related Ninox concept `DE.M1 / Facturado Compass`. |
| `Total Expenses` | numeric | yes | Stored full expense total; components and driver pay are already included. Ninox `DE.Z4`. |
| `Net` | numeric | yes | Stored authoritative net. Intended subtraction has rare live exceptions. Ninox `DE.A5`. |
| `From` | date | yes | Tuesday period start. Ninox `DE.L`. |
| `To` | date | yes | Following Monday period end. |
| `truck_loans` | numeric | yes | Truck loan/dealer-payment expense. For settlement buckets 1/2/3, this is part of the owner's total unassigned truck-loan amount. Ninox `DE.Q3`. |
| `Otro` | numeric | yes | Uncategorized expense component. |
| `LTR Invoices` | numeric | yes | Internal Lightning Trucks Repairs invoice expense. |
| `Tolls` | numeric | yes | Toll expense component. |
| `BestPass` | numeric | yes | BestPass expense component. |
| `Insurance` | numeric | yes | Insurance expense component. For settlement buckets 1/2/3, this is part of the owner's total unassigned insurance amount. |
| `CabCards` | numeric | yes | Cab-card expense component. |
| `Trailer Rentals` | numeric | yes | Trailer-rental expense component. |
| `samsara` | numeric | yes | Samsara expense component. |
| `PrePass` | numeric | yes | PrePass expense component. |
| `Total Driver Pay` | numeric | yes | Total driver-pay expense for the truck/week. Ninox `DE.L3`. |
| `Fuel Expenses` | numeric | yes | Fuel expense component. |
| `To Report` | text | yes | Mixed historical import flag. Do not infer current period from this field alone. |
| `%AppliedSaved` | numeric | yes | Company percentage applied to Gross. Ninox `DE.T2`. |
| `Gross_with_%_deduction_All` | numeric | yes | Gross after percentage; verified formula `Gross × (%AppliedSaved/100)` for eligible live rows. Ninox `DE.G8`. |
| `Driven_miles` | numeric | yes | Miles driven in the period. Ninox `DE.S5`. |
| `ID` | bigint | no | Supabase identity primary key. |

Use stored `Gross`, `Total Expenses`, and `Net`. Do not add `tonu` to Gross or expense components to Total Expenses. Require an explicit period; historical `To Report=Yes` rows make the flag unsafe as a current-cycle selector.
