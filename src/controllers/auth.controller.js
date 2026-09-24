import { User } from "../models/User.model.js";

const registerUser = async (req, res) => {
    try {
        const { username, email, password, firstName, lastName } = req.body;

        // Basic validation
        if (!username || !email || !password || !firstName) {
            return res.status(400).json({ message: "All required fields (username, email, password, firstName) must be provided!" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim().toLowerCase();

        // Check if user already exists (by email or username)
        const existingUser = await User.findOne({
            $or: [
                { email: normalizedEmail },
                { username: normalizedUsername }
            ]
        });

        if (existingUser) {
            return res.status(409).json({ message: "User with this email or username already exists" });
        }

        // Create User (passwordHash will be hashed by Mongoose pre-save hook)
        const user = await User.create({
            username: normalizedUsername,
            firstName: firstName.trim(),
            lastName: lastName ? lastName.trim() : "",
            email: normalizedEmail,
            passwordHash: password,
        });

        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message || "Internal server error" });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const loginIdentifier = email || username;

        // Basic validation
        if (!loginIdentifier || !password) {
            return res.status(400).json({ message: "Email (or username) and password are required!" });
        }

        const normalizedIdentifier = loginIdentifier.trim().toLowerCase();

        // Check if user exists by email or username
        const user = await User.findOne({
            $or: [
                { email: normalizedIdentifier },
                { username: normalizedIdentifier }
            ]
        });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Update last login timestamp
        user.lastLoginAt = new Date();
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            message: "User logged in successfully",
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message || "Internal server error" });
    }
};

const logoutUser = async (req, res) => {

    try {
        const { email } = req.body

        const user = await User.findOne({
            email
        })

        if (!user) return res.status(404).json({
            message: "User not found"
        });

        res.status(200).json({
            message: "Logout Successfull"
        })


    } catch (error) {
        res.status(500).json({
            message: "Internal Sever Error"
        })
    }

}


export {
    registerUser,
    loginUser, logoutUser
};
