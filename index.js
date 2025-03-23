const { MongoClient } = require("mongodb");

// MongoDB connection URL (update if needed)
const uri = "mongodb://localhost:27017"; // Use your actual MongoDB connection string

// Create a new MongoDB client
const client = new MongoClient(uri);

async function main() {
    try {
        // Connect to MongoDB
        await client.connect();
        console.log("Connected to MongoDB!");

        // Select database and collection
        const db = client.db("testDB");
        const collection = db.collection("users");

        // Insert a document
        const result = await collection.insertOne({ name: "Alvinc", age: 22 });
        console.log(`Document inserted with _id: ${result.insertedId}`);

        // Read the document
        const document = await collection.findOne({ _id: result.insertedId });
        console.log("Fetched Document:", document);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        // Close connection
        await client.close();
    }
}

// Run the function
main();
