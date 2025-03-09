require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Define User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    hasPaid: { type: Boolean, default: false } // Optional field for future use
});

// Define Topic Schema
const topicSchema = new mongoose.Schema({
    name: { type: String, required: true },
    subHeading: { type: String, required: true },
    videos: [{
        name: { type: String, required: true },
        path: { type: String, required: true }, // Store only the file name (e.g., "intro.mp4")
        tag: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true }
    }]
});

// Create Models
const User = mongoose.model('User', userSchema);
const Topic = mongoose.model('Topic', topicSchema);

// Middleware for session management
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up EJS for rendering HTML
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Logging
app.use(morgan('combined'));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts, please try again later.',
});

// Set up file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'private', 'videos');
        ensureFolderExists(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// Function to ensure folders exist
const ensureFolderExists = (folderPath) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
};

// Routes
app.get('/', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

// User Registration
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, role: 'user' });
        await newUser.save();

        res.status(200).json({ message: 'User created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// User Login
app.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.loggedInUser = username;
            res.redirect('/videos');
        } else {
            res.status(400).send('Invalid username or password');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Videos Route
app.get('/videos', async (req, res) => {
    if (!req.session.loggedInUser) {
        return res.redirect('/');
    }

    try {
        const topics = await Topic.find();
        res.render('videos', { topics });
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong!');
    }
});

// Route to serve protected videos
app.get('/stream-video', (req, res) => {
    const { video, topic, tag } = req.query;

    // Construct the video path
    const videoPath = path.join(__dirname, 'private', 'videos', topic, tag, video);

    console.log('Requested video path:', videoPath); // Debugging

    // Check if the video file exists
    if (!fs.existsSync(videoPath)) {
        console.error('Video not found:', videoPath); // Debugging
        return res.status(404).send('Video not found.');
    }

    // Get video stats (file size)
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // Handle partial content (streaming)
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunkSize = end - start + 1;
        const file = fs.createReadStream(videoPath, { start, end });

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4',
        });

        file.pipe(res);
    } else {
        // Serve the full video
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        });
        fs.createReadStream(videoPath).pipe(res);
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Insert sample data (if the collection is empty)
const insertSampleData = async () => {
    try {
        const count = await Topic.countDocuments();
        if (count === 0) {
            await Topic.insertMany([
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
            ]);
            console.log('Sample data inserted successfully.');
        } else {
            console.log('Sample data already exists.');
        }
    } catch (error) {
        console.error('Error inserting sample data:', error);
    }
};

// Insert sample data on server start
insertSampleData();

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});