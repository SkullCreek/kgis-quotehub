/**
 * Optional sample data, so you can click around before entering
 * anything real. Run with:  npm run db:seed
 */

import { config } from "dotenv";

// Load the env files before anything imports ./index, which reads
// DATABASE_URL at module scope. Static imports would be hoisted above
// these calls, so the database module is pulled in dynamically below.
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db } = await import("./index");
  const { customers, products } = await import("./schema");

  console.log("Seeding sample customers and products…");

  await db.insert(customers).values([
    {
      name: "Sunrise Packaging Industries",
      contactPerson: "Ramesh Patel",
      gstin: "24AABCU9603R1ZM",
      phone: "+91 98200 11223",
      email: "accounts@sunrisepack.in",
      addressLine1: "Plot 42, GIDC Industrial Estate",
      city: "Vapi",
      state: "Gujarat",
      stateCode: "24",
      pincode: "396195",
      country: "India",
      currency: "INR",
    },
    {
      name: "Deccan Corrugators Pvt Ltd",
      contactPerson: "Ananya Rao",
      gstin: "29AAGCB1286Q1ZP",
      phone: "+91 80 4123 4567",
      addressLine1: "4th Floor, Prestige Tech Park",
      city: "Bengaluru",
      state: "Karnataka",
      stateCode: "29",
      pincode: "560103",
      country: "India",
      currency: "INR",
    },
    {
      name: "Gulf Packaging Machinery LLC",
      contactPerson: "Mr. Qudus Ahmed",
      phone: "+91-9606626190",
      addressLine1: "Warehouse 7, Industrial Area 12",
      city: "Sharjah",
      state: "Sharjah",
      country: "United Arab Emirates",
      currency: "USD",
    },
    {
      name: "Nairobi Carton Works Ltd",
      contactPerson: "J. Mwangi",
      addressLine1: "Baba Dogo Road",
      city: "Nairobi",
      country: "Kenya",
      currency: "USD",
    },
  ]);

  await db.insert(products).values([
    {
      name: "FOLDER",
      description: "3PH 380-480V 50/60HZ 13.0A, Motor 3.7 KW",
      hsn: "8504",
      unit: "Pcs",
      rate: "372.00",
      gstRate: "18.00",
    },
    {
      name: "COUNTER EJECTER",
      description: "INP: 3AC 220-240V 28.9V 50/60HZ, OUP: 3PH 0-360HZ 37.0A",
      hsn: "8537",
      unit: "Pcs",
      rate: "1400.00",
      gstRate: "18.00",
    },
    {
      name: "PLC FBS-60MCT2-AC",
      description: "Without programming",
      hsn: "8537",
      unit: "Pcs",
      rate: "364.00",
      gstRate: "18.00",
    },
    {
      name: "DIE CUTTER",
      description: "3PH 380-480V 50/60HZ 16.8A",
      hsn: "8441",
      unit: "Pcs",
      rate: "230.00",
      gstRate: "18.00",
    },
    {
      name: "HEATING BELT CONNECTION MACHINE - 100 MM",
      hsn: "8515",
      unit: "Nos",
      rate: "320.00",
      gstRate: "18.00",
    },
    {
      name: "Installation & Commissioning",
      description: "On-site labour, per day",
      hsn: "998739",
      unit: "Days",
      rate: "2500.00",
      gstRate: "18.00",
    },
  ]);

  console.log("Done. Open the app and create a quotation.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
