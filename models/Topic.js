const mongoose = require('mongoose');

// Define the Topic schema
const topicSchema = new mongoose.Schema({
    name: { type: String, required: true },
    subHeading: { type: String, required: true },
    videos: [{
        name: { type: String, required: true },
        path: { type: String, required: true }, // Store only the file name (e.g., "intro.mp4")
        tag: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true }
    }]
});

// Create the Topic model
const Topic = mongoose.model('Topic', topicSchema);

// Sample data for testing
const topics = [
    {
        name: "Node.js Basics",
        subHeading: "Learn the fundamentals of Node.js",
        videos: [
            {
                name: "Introduction to Node.js",
                path: "intro.mp4", // Only the file name
                tag: "beginner"
            },
            {
                name: "Setting Up Node.js",
                path: "setup.mp4", // Only the file name
                tag: "beginner"
            },
            {
                name: "Working with Express.js",
                path: "express.mp4", // Only the file name
                tag: "intermediate"
            },
            {
                name: "Middleware in Express.js",
                path: "middleware.mp4", // Only the file name
                tag: "intermediate"
            },
            {
                name: "Advanced Node.js Concepts",
                path: "advanced.mp4", // Only the file name
                tag: "advanced"
            }
        ]
    }
];

// Function to insert sample data into the database
const insertSampleData = async () => {
    try {
        // Check if the collection is empty
        const count = await Topic.countDocuments();
        if (count === 0) {
            // Insert sample data
            await Topic.insertMany(topics);
            console.log('Sample data inserted successfully.');
        } else {
            console.log('Sample data already exists.');
        }
    } catch (error) {
        console.error('Error inserting sample data:', error);
    }
};

// Export the Topic model and insertSampleData function
module.exports = { Topic, insertSampleData };