const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

let db;
async function connectToMongoDB() {
    const uri = "mongodb://localhost:27017";
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

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// GET /users – Fetch all users with proper ID formatting
app.get('/users', async (req, res) => {
    try {
        const users = await db.collection('users').find().toArray();
        const formattedUsers = users.map(user => ({
            ...user,
            id: user._id.toString(),
            _id: undefined // Remove the original _id
        }));
        res.status(200).json(formattedUsers);
    } catch (err) {
        console.error("Users fetch error:", err);
        res.status(500).json({ error: "Failed to fetch users", details: err.message });
    }
});

// GET /rides – Fetch all rides with driver information
app.get('/rides', async (req, res) => {
    try {
        const rides = await db.collection('rides').find().toArray();
        
        const enhancedRides = await Promise.all(rides.map(async ride => {
            const driver = await db.collection('users').findOne({ 
                username: ride.driver,
                role: "driver" 
            });
            
            return {
                ...ride,
                id: ride._id.toString(),
                _id: undefined,
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

// POST /rides - Create a new ride with validation
app.post('/rides', async (req, res) => {
    try {
        const { driver, passenger, pickup, destination } = req.body;
        
        if (!driver || !passenger || !pickup || !destination) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Verify driver exists
        const driverExists = await db.collection('users').findOne({ 
            username: driver,
            role: "driver" 
        });
        
        if (!driverExists) {
            return res.status(400).json({ error: "Driver not found" });
        }

        const rideData = {
            driver,
            passenger,
            pickup,
            destination,
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

app.patch('/rides/:id', async (req, res) => {
    try {
        // Validate the ride ID format
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ 
                error: "Invalid ride ID format",
                details: `Received: ${req.params.id}`
            });
        }

        // Validate the status value
        const validStatuses = ["active", "completed", "cancelled"];
        if (!req.body.status || !validStatuses.includes(req.body.status)) {
            return res.status(400).json({ 
                error: "Invalid status value",
                validStatuses: validStatuses
            });
        }

        // First verify the ride exists
        const ride = await db.collection('rides').findOne({
            _id: new ObjectId(req.params.id)
        });

        if (!ride) {
            return res.status(404).json({ 
                error: "Ride not found",
                id: req.params.id
            });
        }

        // Perform the update
        const result = await db.collection('rides').updateOne(
            { _id: new ObjectId(req.params.id) },
            { 
                $set: { 
                    status: req.body.status,
                    updatedAt: new Date() 
                } 
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).json({ 
                error: "No changes made to ride",
                id: req.params.id,
                currentStatus: ride.status
            });
        }

        // Return the updated ride
        const updatedRide = await db.collection('rides').findOne({
            _id: new ObjectId(req.params.id)
        });

        res.status(200).json({
            message: "Ride status updated successfully",
            ride: {
                id: updatedRide._id.toString(),
                status: updatedRide.status,
                driver: updatedRide.driver,
                passenger: updatedRide.passenger
            }
        });

    } catch (err) {
        console.error("Ride status update error:", err);
        res.status(500).json({ 
            error: "Failed to update ride status",
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// DELETE /rides/:id - Delete a ride
app.delete('/rides/:id', async (req, res) => {
    try {
        // Validate the ride ID format
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ 
                error: "Invalid ride ID format",
                details: `Received: ${req.params.id}`
            });
        }

        // First verify the ride exists
        const ride = await db.collection('rides').findOne({
            _id: new ObjectId(req.params.id)
        });

        if (!ride) {
            return res.status(404).json({ 
                error: "Ride not found",
                id: req.params.id
            });
        }

        // Perform the deletion
        const result = await db.collection('rides').deleteOne({
            _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
            return res.status(500).json({ 
                error: "Failed to delete ride",
                id: req.params.id
            });
        }

        res.status(200).json({
            message: "Ride deleted successfully",
            deletedRide: {
                id: req.params.id,
                driver: ride.driver,
                passenger: ride.passenger
            }
        });

    } catch (err) {
        console.error("Ride deletion error:", err);
        res.status(500).json({ 
            error: "Failed to delete ride",
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// POST /users - Create a new user with enhanced validation
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

        const userData = {
            username,
            password,
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
            role
        });
    } catch (err) {
        console.error("User registration error:", err);
        res.status(500).json({ error: "Failed to register user", details: err.message });
    }
});

// Enhanced PATCH /users/:id - Update a user
app.patch('/users/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        // Prevent changing certain fields
        if (req.body._id || req.body.username || req.body.createdAt) {
            return res.status(400).json({ error: "Cannot modify protected fields" });
        }

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: req.body }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "User not found or no changes made" });
        }
        
        const updatedUser = await db.collection('users').findOne(
            { _id: new ObjectId(req.params.id) }
        );
        
        res.status(200).json({
            id: req.params.id,
            username: updatedUser.username,
            role: updatedUser.role
        });
    } catch (err) {
        console.error("User update error:", err);
        res.status(500).json({ error: "Failed to update user", details: err.message });
    }
});

// Enhanced DELETE /users/:id - Delete a user
app.delete('/users/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        const result = await db.collection('users').deleteOne(
            { _id: new ObjectId(req.params.id) }
        );
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.status(200).json({
            message: "User deleted successfully",
            id: req.params.id
        });
    } catch (err) {
        console.error("User deletion error:", err);
        res.status(500).json({ error: "Failed to delete user", details: err.message });
    }
});

// Enhanced auth/login endpoint
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        const user = await db.collection('users').findOne({ username });

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.status(200).json({ 
            message: 'Login successful', 
            userId: user._id.toString(),
            username: user.username,
            role: user.role
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Fixed PATCH /drivers/:id/status - Update driver availability
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
        res.status(500).json({ 
            error: "Server error during status update",
            details: err.message 
        });
    }
});

// Enhanced admin user deletion
app.delete('/admin/users/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }


        const result = await db.collection('users').deleteOne(
            { _id: new ObjectId(req.params.id) }
        );
        
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
