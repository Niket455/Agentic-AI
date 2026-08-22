

"""
  Create a class Employee which have 3 members
  emp_no,
  emp_name ,
  leaves.
  Leaves is a dictionary with the three keys "EL", "CL", "SL"
  which are the type of leaves.

  Define __init__() to initialize the values.

  Create another class Company which has two fields
  cname and emps.

  cname is the company name and emps is the list of employees.

  Create a function leave_available() to which takes two
  parameters emp_no and type of leave and used to print
  the number of leaves remaining.

  Create another function leave_permission() which takes
  empno , type of leave and num of leave.

  if the available leave of a employee is greater than
  equal to the number of leaves employee want then
  print "Granted" else print "Rejected".

  Take 2 input of empno,empname,leaves(all type)
  take input empid,type of leaves,leaves duration and check if
  granted or not.

Input:
2
1
Rajesh
5
10
15
2
Sudhir
10
10
10
1
SL
20

Output:

10
Rejected
"""
#Solution -----



class Employee:
    def __init__(self, emp_no, emp_name, leaves):
        self.emp_no = emp_no
        self.emp_name = emp_name
        self.leaves = leaves

class Company:
    def __init__(self, cname, emps):
        self.cname = cname
        self.emps = emps

    def leave_available(self, empno, leave_type):
        for emp in self.emps:
            if emp.emp_no == empno:
                print(emp.leaves[leave_type])

    def leave_permission(self, empno, type_of_leave, leave_no):
        for emp in self.emps:
            if emp.emp_no == empno:
                if emp.leaves[type_of_leave]>=leave_no:
                    print("Granted")
                else:
                    print("Rejected")

n = int(input())

empList = []
for i in range(n):
    emp_no = int(input())
    emp_name= input()
    leaves = {
        "EL": int(input()),
        "CL": int(input()),
        "SL": int(input())
    }
    empList.append(Employee(emp_no, emp_name, leaves))

empid = int(input())
leave_type = input()
leave_no = int(input())

company = Company("ABC", empList)
company.leave_available(empid, leave_type)
company.leave_permission(empid, leave_type, leave_no)


    
            
