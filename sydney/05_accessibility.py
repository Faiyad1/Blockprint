import pandas as pd

# Load accessibility data from CSV
df = pd.read_csv("sydney/sydney_accessibility_data.csv")

print("Accessibility dataset loaded successfully!")

print(df)

print("\nTotal destinations:", len(df))