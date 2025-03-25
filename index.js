const { MongoClient } = require("mongodb");

const drivers = [
    { name: "Alvinc ",
     vehicleType: "Sedan", 
     rating: 4.7, available: true 
    },
    {
     name: "vagesh", 
     vehicleType: "Suv", 
     rating: 4.9, available: false
    },
    { name: "dharvin", 
    vehicleType: "Hatchback", 
    rating: 4.2, available: true }
];

console.log(drivers);
drivers.push(
    { 
    name: "dHARVIN 2",
    vehicleType: "Sedan",
    rating: 4.8, available: true });
console.log("Updated Drivers:", drivers);
drivers.forEach(driver => {
    console.log(`Driver Name: ${driver.name}`);
});

async function main() {
    const uri = "mongodb://localhost:27017";  
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        const db = client.db("rideSharing");
        const collection = db.collection("drivers");
        
        const result = await collection.insertMany(drivers);
        console.log(`Inserted ${result.insertedCount} drivers`);
        
        const topDrivers = await collection.find({ rating: { $gte: 4.5 } }).toArray();
        console.log("Top Drivers:", topDrivers);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
    }
}

async function updateDriver() {
    const uri = "mongodb://localhost:27017";  
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db("rideSharing");
        const collection = db.collection("drivers");

        const result = await collection.updateMany(
            { rating: { $gte: 4.5 } },
            { $inc: { rating: 0.1 } }
        );
        console.log("Updated Documents:", result.modifiedCount);        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
    }
}
async function removeUnavailableDrivers() {
    const uri = "mongodb://localhost:27017";  
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("rideSharing");
        const collection = db.collection("drivers");

        const result = await collection.deleteMany({ available: false });
        console.log("Deleted Documents:", result.deletedCount);
    } finally {
        await client.close();
    }
}

async function run() {
    await main();
    await updateDriver();
    await removeUnavailableDrivers();
}

run();
