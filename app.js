const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const session = require("express-session");
const sharedSession = require('express-socket.io-session');
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const { userInfo } = require('os');
const multer = require("multer");
app.use(express.static('public'));

main().catch(err => console.log(err));
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/freelance');
}
const port = process.env.PORT|| 80;
app.use(session({
    secret: "Abhayislove1234",
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: "mongodb://127.0.0.1:27017/freelance",collectionName: "sessions" }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 365 * 100 } 
}));
const sessionMiddleware = session({
    secret: "Abhayislove1234",
    resave: false,
    saveUninitialized: false,
  });
app.use(sessionMiddleware);
app.use('/static',express.static('static'));
app.use(express.urlencoded())
app.set('view engine','pug')
app.set('views',path.join(__dirname,'views'))
app.use(bodyParser.json()); // Enable JSON parsing
app.use(bodyParser.urlencoded({ extended: true })); // Fix deprecated warning
app.use(express.json());
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

io.use(sharedSession(sessionMiddleware, {
    autoSave: true
  }));
io.on("connection", (socket) => {
  console.log("User connected ");

  socket.on("chat message", (msg) => {
    console.log("Message received:", msg);
    io.emit("chat message", msg); // send to all
  });
}); 
//SIGNUP PAGE
app.get("/Signup", (req, res) => {
    res.status(200).render('signup.pug');
}); 

const SignupSchema = new mongoose.Schema({
    firstname: String,
    surname: String,    
    emailid: String,
    phoneno: Number,
    username: String,
    password: String,
    profilePic: { type: String, default: "/uploads/default.png" }, // Store image path
});

const Signup = mongoose.model('SignupInfo', SignupSchema); // Fix model name

app.post("/Signup", async (req, res) => { // Make function async
    try {
        const userinfo = new Signup(req.body); // Fix model reference
        // Check if user already exists
        const existingUser = await Signup.findOne({ username: userinfo.username });
        const existingUser1 = await Signup.findOne({ phoneno: userinfo.phoneno });
        const existingUser2 = await Signup.findOne({ emailid: userinfo.email }); // Use await
        if (existingUser || existingUser1 || existingUser2) {
            return res.send('User already exists, please try another username.');
        }
        // Save new user
        const saltrounds = 10;
        const hashedpassword = await bcrypt.hash(userinfo.password , saltrounds);
        userinfo.password = hashedpassword;
        await userinfo.save();
        res.render('login.pug');
    } catch (error) {
        console.error(error);
        res.status(400).send('An error occurred. Please try again.');
    }
});


//LOGIN PAGE
app.get("/Login", (req,res)=>{
    res.status(200).render('login.pug');
})
const LoginSchema = new mongoose.Schema({
    username: String,
    password: String,
});
const logininfo = mongoose.model('LoginInfo', LoginSchema);
app.post("/Login", async (req, res) => {
    try {
        // Find user in the database
        const check = await Signup.findOne({ username: req.body.username });
        if (!check) {
            return res.send('User cannot be found');
        }
        // Compare hashed password from database
        const isPasswordMatch = await bcrypt.compare(req.body.password, check.password);
        if (isPasswordMatch) {
            req.session.user = {
                id: check._id,
                username: check.username,
                email: check.emailid,
                firstname : check.firstname,
                surname : check.surname,
            };
            await req.session.save();
            res.redirect('/dashboard'); // Redirect to homepage
        } else {
            res.send("Wrong password, bro.");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred. Please try again.");
    }
});

app.get("/",(req,res)=>{
    res.status(200).render('index.pug');
})
app.get("/Home", (req, res) => {
    if (!req.session.user) return res.redirect("/Login"); // Redirect if not logged in
    res.render("home.pug");
});
//Logout
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error logging out.");
        }
        res.render("index.pug"); // Redirect to login page after logout
    });
});


//Uploading pfp
app.use("/uploads", express.static("uploads"));

// Ensure the "uploads" folder exists
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        if (!req.session.user || !req.session.user.id) {
            return cb(new Error("User ID not found in session"), null);
        }
        const uniqueName = `${req.session.user.id}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});

const upload = multer({ storage });

// Upload Profile Picture Route
app.post("/uploadPfp", upload.single("pfp"), async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).send("Unauthorized");

        const imagePath = `/uploads/${req.file.filename}`; // Relative path

        // Update profile picture in MongoDB
        const updatedUser = await Signup.findByIdAndUpdate(
            req.session.user.id,
            { profilePic: imagePath },
            { new: true }
        );

        if (!updatedUser) return res.status(404).send("User not found");

        // Update session with new profile picture path
        req.session.user.profilePic = updatedUser.profilePic;

        res.redirect("/dashboard");
    } catch (err) {
        console.error("Profile Picture Upload Error:", err);
        res.status(500).send("Error uploading file.");
    }
});

//DASHBOARD SCHEMA 
const DashboardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "SignupInfo", required: true }, // Link to user
    bio: { type: String, default: "" },
    jobCategory: { type: String, required: true },
    jobDescription: { type: String, default: "" },
    pastProjects: [{ type: String }] // Store file paths (images/videos)
});

const Dashboard = mongoose.model("Dashboard", DashboardSchema);

app.get("/dashboard", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/login");
        }

        // Fetch dashboard data from MongoDB
        let dashboardData = await Dashboard.findOne({ userId: req.session.user.id });

        // If no dashboard data exists, create a new one with default values
        if (!dashboardData) {
            dashboardData = new Dashboard({
                userId: req.session.user.id,
                bio: "",
                jobCategory: "Not Specified",
                jobDescription: "",
                pastProjects: []
            });
        
            await dashboardData.save();
        }

        // Ensure pastProjects is always an array to prevent errors
        res.render("dashboard", { 
            user: req.session.user, 
            dashboard: { ...dashboardData.toObject(), pastProjects: dashboardData.pastProjects || [] }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading dashboard.");
    }
});
app.post("/updateDashboard", upload.array("projects", 5), async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send("Unauthorized");
        }

        // Extract user inputs from the form
        const { bio, jobCategory, jobDescription } = req.body;
        const uploadedFiles = req.files.map(file => "/uploads/" + file.filename); // Store file paths

        // Update the user's dashboard data in MongoDB
        const updatedDashboard = await Dashboard.findOneAndUpdate(
            { userId: req.session.user.id },
            { 
                bio, 
                jobCategory, 
                jobDescription,
                $push: { pastProjects: { $each: uploadedFiles } } // Append new projects
            },
            { new: true, upsert: true } // Create if not exists
        );

        res.redirect("/dashboard"); // Redirect after update
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating dashboard.");
    }
});
app.delete('/deleteProject', async (req, res) => {
    const filePath = req.query.path;

    if (!filePath) {
        return res.status(400).send("No file path provided");
    }

    const absolutePath = path.join(__dirname, filePath);

    try {
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath); // Delete from filesystem
        }

        // Then also remove from the user's `pastProjects` array in DB
        await Dashboard.updateOne(
            { username: req.session.user.username }, // Or however you identify the user
            { $pull: { pastProjects: filePath } }
        );

        res.status(200).send("Deleted successfully");
    } catch (err) {
        console.error("Error deleting file:", err);
        res.status(500).send("Server error");
    }
});
//HIRE PAGE

app.get("/Hire",(req,res)=>{
    if (!req.session.user) return res.redirect("/Login");
    res.status(200).render('hire.pug');
})
const HireSchema = new mongoose.Schema({
    userID: { type: mongoose.Schema.Types.ObjectId, ref: "SignupInfo", required: true },
    desc: String,
    price: Number,
    jobCategory: String,
});
const hireinfo = mongoose.model('HireInfo', HireSchema);
app.post("/Hire", (req, res) => {
    if (!req.session.user) return res.redirect("/Login");

    const hire = new hireinfo({
        userID: req.session.user.id, // ✅ inject userID manually
        desc: req.body.desc,
        price: req.body.price,
        jobCategory: req.body.jobCategory,
    });

    hire.save()
        .then(() => {
            res.redirect("/FindWork"); // ✅ redirect to FindWork after submission
        })
        .catch((err) => {
            console.error(err);
            res.status(400).send('An error occurred, please try again');
        });
});
//FINDWORK
app.get("/FindWork", async (req, res) => {
    if (!req.session.user) return res.redirect("/Login");
    try {
        const jobs = await hireinfo.find().populate("userID", "username");
        res.status(200).render("findwork.pug", {
            jobs,
            currentUserId: req.session.user?.id // Pass logged-in user's ID
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error while loading jobs");
    }
});
app.post("/deleteJob/:id", async (req, res) => {
    if (!req.session.user) return res.redirect("/Login");

    try {
        const job = await hireinfo.findById(req.params.id);
        if (!job) return res.status(404).send("Job not found");

        // ✅ Only delete if current user owns the job
        if (job.userID.toString() !== req.session.user.id) {
            return res.status(403).send("Unauthorized");
        }

        await hireinfo.findByIdAndDelete(req.params.id);
        res.redirect("/FindWork");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting job");
    }
});
//INTERESTS
const interestSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "HireInfo" },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: "SignupInfo" },
    timestamp: { type: Date, default: Date.now }
});
const Interest = mongoose.model("Interest", interestSchema);

app.post("/interested/:jobId", async (req, res) => {
    if (!req.session.user) return res.status(401).send("Login first");

    try {
        const existingUser = await Interest.findOne({ jobId: req.params.jobId });
        if (existingUser ) {
            return res.send('Your request has already been sent');
        }
        const newInterest = new Interest({
            jobId: req.params.jobId,
            freelancerId: req.session.user.id
        });
        await newInterest.save();
        res.redirect("/FindWork"); // or show a success message
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});
app.get("/clientsjobs", async (req, res) => {
    if (!req.session.user) return res.status(401).send("Unauthorized");

    try {
        const postedJobs = await hireinfo.find({ userID: req.session.user.id });
        const jobIds = postedJobs.map(job => job._id);
        const interests = await Interest.find({ jobId: { $in: jobIds } }).populate("freelancerId");
        res.render("clientsjobs", {
            jobs: postedJobs,
            interests: interests,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});
//Viewing Freelancers Dashboard
app.get("/freelancerDashboard/:freelancerId", async (req, res) => {
    try {
        const freelancer = await Signup.findById(req.params.freelancerId);
        const freelancerdashboard = await Dashboard.findOne({ userId: new mongoose.Types.ObjectId(req.params.freelancerId) });
        res.render("freelancedashboard", {
            freelancerdashboard,
            freelancer
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading freelancer dashboard");
    }
});
//Chatting
app.get('/chat/:id', async (req, res) => {
    try {
      const currentUser = await hireinfo.findOne({ userID: req.session.user.id });
      const freelancer = await Signup.findById(req.params.id);
  
      if (!currentUser || !freelancer) return res.status(404).send('User not found');
  
      res.render('chatpage', {
        chatId: req.params.id,
        loggedInUser: { username: req.session.user.username },  // pull directly from session
        otherUserName: freelancer.username
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error loading chat page');
    }
  });

  io.on("connection", (socket) => {
    const session = socket.handshake.session;
    const user = session.user;
  
    if (!user) {
      console.log("No session user found, denying socket connection.");
      return;
    }
  
    console.log(`User connected: ${user.username}`);
  
    socket.on("joinRoom", (chatId) => {
      socket.join(chatId);
      console.log(`${user.username} joined room ${chatId}`);
    });
  
    socket.on("chat message", ({ chatId, text }) => {
      io.to(chatId).emit("chat message", {
        sender: user.username,  // session-safe!
        content: text
      });
    });
  });

http.listen(80, () => {
  console.log("Server running on port 80");
});

//CONTACT US PAGE
app.get("/ContactUs",(req,res)=>{
    if (!req.session.user) return res.redirect("/Login");
    res.status(200).render('contactus.pug');
})
const ContactSchema = new mongoose.Schema({
    username: String,
    emailid: String,
    phone: Number,
    desc: String,
  });
const contactus = mongoose.model('contact', ContactSchema);
app.post("/ContactUs",(req,res)=>{
    var contactdata = new contactus(req.body);
    contactdata.save().then(()=>{
        res.send('your concern has been submitted we will get back to you soon ')
    }).catch(()=>{
        res.status(400).send('an error occured please try again')
    })
})  