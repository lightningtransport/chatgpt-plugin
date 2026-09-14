# Metric definitions

Read `AGENTS.md` and the report metadata before calculating.

## Settlement metrics

| Metric | Definition | Source |
|---|---|---|
| Gross | Stored total settlement gross before percentage and expenses. Do not add `tonu`. | `settlements.Gross` |
| Additional/Compass income | Physical import field `tonu`; related Ninox concept is `Facturado Compass`. It is already included in Gross and must not be interpreted as a tonnage quantity. | `settlements.tonu` |
| Total expenses | Stored full settlement expense total. Do not add category columns or driver pay again. | `settlements.Total Expenses` |
| Net | Stored authoritative net. The intended formula is gross-after-percentage minus total expenses, but verified live rows contain rare exceptions and null-expense cases. | `settlements.Net` |
| Gross after percentage | `Gross × (%AppliedSaved / 100)` for eligible verified rows. Not Gross or Net. | `settlements.Gross_with_%_deduction_All` |
| Driven miles | Period mileage. | `settlements.Driven_miles` |
| Current reporting cycle | Select by an explicit Tuesday `From` period. `To Report` alone is unsafe because historical rows contain `Yes` and newer rows contain `true`. | `settlements.From` |

Settlement periods run Tuesday through Monday. Attribute historical owner/dispatch using the settlement row.

### Owner-allocation buckets

Only in `settlements` and settlement-derived reports, `Truck` 1=Carlos, 2=Jorge, and 3=CDT. These are non-physical owner-expense allocation buckets. Each bucket holds that owner's total `truck_loans` and `Insurance` amounts that are not applied to a specific physical truck.

- Include bucket rows in the respective owner's general settlement totals.
- Exclude them from physical-truck counts and rankings.
- Display them as non-physical owner-expense allocation buckets and state whether they were included.

## Operational metrics

| Metric | Definition | Source |
|---|---|---|
| Fleet count | Distinct `truck_number`; do not use the settlement-only 1/2/3 allocation-bucket rule to filter `trucks`. | `trucks` |
| Trucks leaving | Distinct `Truck_Number` filtered by `Out Date` only. | `DriverPay` |
| Trucks returning historically | Distinct `Truck_Number` filtered by `Return Date` only. | `DriverPay` |
| Current expected returns | Current Returns rows by nullable date; deduplicate `Truck` for truck count. | `returns` |
| Current fleet assignment | Current owner/dispatcher/mechanic metadata, not history. | `trucks` |
| Planned departures | Not available in these Supabase tables; use approved live Ninox Schedule_Teams source. | external |
| Exact in-yard/on-road count | Not available because Supabase lacks Ninox `days_in_yard_` and numeric insurance-choice fields. | external |

## Driver pay

For each DriverPay assignment that overlaps the settlement week:

```text
MoneyPerWeekSigned + CPM × max(Driven_miles − Pay CPM after Miles, 0)
```

Calculate per driver assignment. Do not divide team pay unless the requester explicitly defines a split. Review transfer and termination dates that fall inside the period.
