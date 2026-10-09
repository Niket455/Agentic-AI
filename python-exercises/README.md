# Python Exercises

Console-based **OOP practice problems** with solutions. Each file contains the problem statement in
its module docstring, followed by a working solution. Input is read from `stdin`.

| File | Topic | What it practices |
|---|---|---|
| `oops1.py` | Student & School | Classes, methods, computing averages, filtering a list, finding a maximum |
| `oops2.py` | Employee & Organization | Classes with defaults, dictionary aggregation, eligibility rules, totaling a bonus |
| `oops3.py` | Employee & Company | Nested dictionaries, lookups by id, conditional decisions (grant/reject) |

## Run

Each script reads its test case from standard input:

```bash
cd python-exercises
python oops1.py < input.txt
```

For example, `oops2.py` expects: a count of employees, then per employee their name, designation,
salary, number of overtime months, and month/hour pairs, followed by the overtime threshold and the
per-hour rate.

```text
5
Sunita
Faculty
23000
2
Jan
4
March
6
...
18
100
```
