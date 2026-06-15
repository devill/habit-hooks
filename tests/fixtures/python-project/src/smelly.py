import os  # F401: unused import -> unused-import


def classify(a, b, c, d, e, f):  # PLR0913: 6 args -> too-many-parameters
    unused = 99  # F841: assigned but never used -> unused-variable
    total = 0
    for i in range(a):  # C901: dense branching -> high-complexity
        if i % 2 == 0 and b > c:
            total += 1
        elif i % 3 == 0 and c > d:
            total += 2
        elif i % 4 == 0 and d > e:
            total += 3
        elif i % 5 == 0 and e > f:
            total += 4
        elif i % 6 == 0 or b == c:
            total += 5
        elif i % 7 == 0 or c == d:
            total += 6
        elif i % 8 == 0:
            total -= 1
        else:
            total -= 2
    return total
