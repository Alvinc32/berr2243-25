Link to Postman collections:Lab 4
Drivers: https://drive.google.com/file/d/1SXcL1nZ29cFZqzRgjHNrdc50OvCcxH7P/view?usp=sharing
Ride-Hailing: https://drive.google.com/file/d/1XnwYU1UgQy3HLenZHEl8bQlR69YddOXN/view?usp=sharing


#  Data Model – Ride Management System

##  Users Collection

| Field         | Type      | Description                                |
|---------------|-----------|--------------------------------------------|
| _id           | ObjectId  | MongoDB auto-generated ID                  |
| username      | String    | Unique login name                          |
| password      | String    | Stored plaintext for now                   |
| role          | String    | 'passenger', 'driver', or 'admin'          |
| availability  | String    | 'online', 'offline' (drivers only) |
| createdAt     | Date      | Registration time                          |

## Rides Collection

| Field         | Type      | Description                          |
|---------------|-----------|--------------------------------------|
| _id           | ObjectId  | Unique ride ID                       |
| driver        | String    | Driver’s username                    |
| passenger     | String    | Passenger’s username                 |
| pickup        | String    | Pickup location                      |
| destination   | String    | Drop-off location                    |
| status        | String    | 'active', 'completed', or 'cancelled'|
| createdAt     | Date      | Ride creation time                   |
| updatedAt     | Date      | Last update time (if any)            |
