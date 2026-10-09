"""
Create a class Student with the below attributes:
name of type String
sub1 of type float
sub2 of type float
sub3 of type float

Create the __init__ method which takes all parameters in the above sequence.

Create a method calculateResult() in the Student class.

It checks if the student has scored greater than 40 in all the individual
3 subjects. If so, it further calculates the average and returns average.

Create another class School with the below attributes:
name of type String
studentDict of type dictionary

Where key is a Student object and value refers to the result pass or fail.

Create the __init__ method which takes all parameters in the above sequence.

Define the two methods getStudentResult and findStudentWithHighestMarks
in this School class.

getStudentResult:
This method internally calls calculateResult method of Student class
to get average.

This method checks if the student average is greater than 60 then it
updates the student dictionary value as pass.

Displays the names of students who passed.
If no student passed, print 'No student passed'.

findStudentWithHighestMarks:
This method accepts the list of passed students.
Display the name of the highest scored student.

Input:

4
Harshit Gupta
91
88
78
Ayush Joshi
94
83
90
Mahi Meena
95
87
90
Yogesh Singh
41
42
41

Output:

List of Passed Students:
Harshit Gupta
Ayush Joshi
Mahi Meena
Student Obtained Maximum Marks: Mahi Meena
"""

#solution---


class Student:
    def __init__(self, name, sub1, sub2, sub3):
        self.name = name
        self.sub1 = sub1
        self.sub2 = sub2
        self.sub3 = sub3

    def calculateResult(self):
        if self.sub1 > 40 and self.sub2 > 40 and self.sub3 > 40:
            avgPer = ((self.sub1 + self.sub2 + self.sub3) / 300) * 100
            return avgPer
        else:
            return -1


class School(Student):
    def getStudentResult(obj_list):
        isPass = False
        studentList = []

        for i in obj_list:
            result = i.calculateResult()

            if result > 60:
                isPass = True
                studentList.append([i.name, result])
                print(i.name)

        if not isPass:
            print("No Student passed")
        else:
            return studentList

    def findStudentWithHighestMarks(pass_std):
        temp = pass_std[0][1]

        for i in pass_std:
            if temp < i[1]:
                std_name = i[0]
                temp = i[1]

        return std_name


n = int(input())
obj_list = []

for i in range(n):
    name = input()
    sub1 = int(input())
    sub2 = int(input())
    sub3 = int(input())

    obj_list.append(Student(name, sub1, sub2, sub3))


print("List of Passed Students:")
res_1 = School.getStudentResult(obj_list)

print("Student Obtained Maximum Marks: ", end="")
res_2 = School.findStudentWithHighestMarks(res_1)

print(res_2)