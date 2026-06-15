def summarize(records):
    tax = sum(r["total"] for r in records) * 0.1
    shipping = 0 if sum(r["total"] for r in records) > 100 else 10
    discount = sum(r["total"] for r in records) * 0.05
    return sum(r["total"] for r in records) + tax + shipping - discount
