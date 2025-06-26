const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const saltRounds = 10;
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Database connection
let db;
async function connectToMongoDB() {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB!");
        db = client.db("testDB");

        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}
connectToMongoDB();

// --- USER ROUTES ---

// Create a new user (register)
app.post('/users', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const validRoles = ["passenger", "driver", "admin"];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role specified" });
    }

    try {
        const existingUser = await db.collection('users').findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const userData = {
            username,
            password: hashedPassword,
            role,
            createdAt: new Date()
        };

        if (role === "driver") {
            userData.availability = "offline";
        }

        const result = await db.collection('users').insertOne(userData);

        res.status(201).json({
            id: result.insertedId.toString(),
            username,
            role,
            availability: userData.availability || undefined
        });
    } catch (err) {
        console.error("User registration error:", err);
        res.status(500).json({ error: "Failed to register user", details: err.message });
    }
});

// Fetch all users
app.get('/users', async (req, res) => {
    try {
        const users = await db.collection('users').find().toArray();
        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            role: user.role,
            availability: user.availability || undefined,
            createdAt: user.createdAt
        }));
        res.status(200).json(formattedUsers);
    } catch (err) {
        console.error("Users fetch error:", err);
        res.status(500).json({ error: "Failed to fetch users", details: err.message });
    }
});

// Fetch a single user
app.get('/users/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({
            id: user._id.toString(),
            username: user.username,
            role: user.role,
            availability: user.availability || undefined,
            createdAt: user.createdAt
        });
    } catch (err) {
        console.error("User fetch error:", err);
        res.status(500).json({ error: "Failed to fetch user", details: err.message });
    }
});

// Update a user partially
app.patch('/users/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        if (req.body._id || req.body.username || req.body.createdAt || req.body.password) {
            return res.status(400).json({ error: "Cannot modify protected fields" });
        }

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: req.body }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "User not found or no changes made" });
        }

        const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });

        res.status(200).json({
            id: req.params.id,
            username: updatedUser.username,
            role: updatedUser.role,
            availability: updatedUser.availability || undefined
        });
    } catch (err) {
        console.error("User update error:", err);
        res.status(500).json({ error: "Failed to update user", details: err.message });
    }
});

// Delete a user (admin)
app.delete('/admin/users/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({
            message: "User deleted by admin",
            id: req.params.id
        });
    } catch (err) {
        console.error("Admin user deletion error:", err);
        res.status(500).json({ error: "Failed to delete user", details: err.message });
    }
});

// --- AUTH ROUTE ---

// Authenticate user
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        const user = await db.collection('users').findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id.toString(),
                username: user.username,
                role: user.role,
                availability: user.availability || undefined
            }
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Server error during login", details: err.message });
    }
});

// --- RIDE ROUTES ---

// Get all rides with driver info
app.get('/rides', async (req, res) => {
    try {
        const rides = await db.collection('rides').find().toArray();

        const enhancedRides = await Promise.all(rides.map(async (ride) => {
            const driver = await db.collection('users').findOne({ username: ride.driver, role: "driver" });

            return {
                id: ride._id.toString(),
                driver: ride.driver,
                passenger: ride.passenger,
                pickup: ride.pickup,
                destination: ride.destination,
                status: ride.status,
                fare: ride.fare,
                distance: ride.distance,
                createdAt: ride.createdAt,
                driverId: driver?._id.toString(),
                driverStatus: driver?.availability || 'offline'
            };
        }));

        res.status(200).json(enhancedRides);
    } catch (err) {
        console.error("Rides fetch error:", err);
        res.status(500).json({ error: "Failed to fetch rides", details: err.message });
    }
});

// Create a new ride
app.post('/rides', async (req, res) => {
    try {
        const { driver, passenger, pickup, destination, distance } = req.body;

        if (!driver || !passenger || !pickup || !destination || typeof distance !== 'number') {
            return res.status(400).json({ error: "Missing or invalid required fields" });
        }

        const driverExists = await db.collection('users').findOne({ username: driver, role: "driver" });
        if (!driverExists) {
            return res.status(400).json({ error: "Driver not found" });
        }

        let fare = 5;
        if (distance > 5) {
            fare += Math.ceil(distance - 5);
        }

        const rideData = {
            driver,
            passenger,
            pickup,
            destination,
            distance,
            fare: parseFloat(fare.toFixed(2)),
            status: "active",
            createdAt: new Date()
        };

        const result = await db.collection('rides').insertOne(rideData);

        res.status(201).json({
            id: result.insertedId.toString(),
            ...rideData
        });
    } catch (err) {
        console.error("Ride creation error:", err);
        res.status(500).json({ error: "Failed to create ride", details: err.message });
    }
});

// Update ride status
app.patch('/rides/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid ride ID format", details: `Received: ${req.params.id}` });
        }

        const validStatuses = ["active", "completed", "cancelled"];
        if (!req.body.status || !validStatuses.includes(req.body.status)) {
            return res.status(400).json({ error: "Invalid status value", validStatuses });
        }

        const ride = await db.collection('rides').findOne({ _id: new ObjectId(req.params.id) });
        if (!ride) {
            return res.status(404).json({ error: "Ride not found", id: req.params.id });
        }

        const result = await db.collection('rides').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: req.body.status, updatedAt: new Date() } }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).json({ error: "No changes made to ride", id: req.params.id, currentStatus: ride.status });
        }

        const updatedRide = await db.collection('rides').findOne({ _id: new ObjectId(req.params.id) });

        res.status(200).json({
            message: "Ride status updated successfully",
            ride: {
                id: updatedRide._id.toString(),
                status: updatedRide.status,
                driver: updatedRide.driver,
                passenger: updatedRide.passenger,
                fare: updatedRide.fare,
                distance: updatedRide.distance
            }
        });
    } catch (err) {
        console.error("Ride status update error:", err);
        res.status(500).json({ error: "Failed to update ride status", details: err.message });
    }
});

// Delete a ride
app.patch('/drivers/:id/status', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid driver ID format" });
        }

        const validStatuses = ["online", "offline", "busy"];
        if (!req.body.availability || !validStatuses.includes(req.body.availability)) {
            return res.status(400).json({ error: "Invalid availability status" });
        }

        const result = await db.collection('users').updateOne(
            { 
                _id: new ObjectId(req.params.id), 
                role: "driver" 
            },
            { $set: { availability: req.body.availability } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ 
                error: "Driver not found or no change made",
                details: {
                    idUsed: req.params.id,
                    currentRole: (await db.collection('users').findOne({ 
                        _id: new ObjectId(req.params.id) 
                    }))?.role
                }
            });
        }

        const updatedDriver = await db.collection('users').findOne(
            { _id: new ObjectId(req.params.id) }
        );
        
        res.status(200).json({
            message: "Driver status updated",
            id: req.params.id,
            availability: updatedDriver.availability
        });
    } catch (err) {
        console.error("Driver status update error:", err);
        res.status(500).json({ error: "Server error during status update", details: err.message });
    }
});

// Fetch all users (admin)
app.get('/admin/users', async (req, res) => {
    try {
        const users = await db.collection('users').find().toArray();

        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            role: user.role,
            availability: user.availability || undefined,
            createdAt: user.createdAt
        }));

        res.status(200).json(formattedUsers);
    } catch (err) {
        console.error("Admin fetch error:", err);
        res.status(500).json({ error: "Failed to fetch users", details: err.message });
    }
});
// Backend: Add this route to handle ride deletion
app.delete('/rides/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid ride ID format" });
        }

        const result = await db.collection('rides').deleteOne({ _id: new ObjectId(req.params.id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }

        res.status(200).json({
            message: "Ride deleted successfully",
            id: req.params.id
        });
    } catch (err) {
        console.error("Ride deletion error:", err);
        res.status(500).json({ error: "Failed to delete ride", details: err.message });
    }
});
// Aggregation of passenger ride statistics
app.get('/analytics/passengers', async (req, res) => {
    try {
        const pipeline = [
            { $match: { role: "passenger" } },
            {
                $lookup: {
                    from: "rides",
                    localField: "username",
                    foreignField: "passenger",
                    as: "rides"
                }
            },
            {
                $unwind: {
                    path: "$rides",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: "$username",
                    totalRides: {
                        $sum: { $cond: [{ $ifNull: ["$rides", false] }, 1, 0] }
                    },
                    totalFare: { $sum: { $ifNull: ["$rides.fare", 0] } },
                    totalDistance: { $sum: { $ifNull: ["$rides.distance", 0] } }
                }
            },
            {
                $addFields: {
                    avgDistance: {
                        $cond: [
                            { $eq: ["$totalRides", 0] },
                            0,
                            { $divide: ["$totalDistance", "$totalRides"] }
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    totalRides: 1,
                    totalFare: { $round: ["$totalFare", 2] },
                    avgDistance: { $round: ["$avgDistance", 2] }
                }
            },
            { $sort: { name: 1 } }
        ];

        const results = await db.collection('users').aggregate(pipeline).toArray();
        res.status(200).json(results);
    } catch (err) {
        console.error("Aggregation error:", err);
        res.status(500).json({ error: "Failed to perform aggregation", details: err.message });
    }
});