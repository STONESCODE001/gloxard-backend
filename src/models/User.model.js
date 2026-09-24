import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

const socialLinksSchema = new Schema(
    {
        website: { type: String, default: "" },
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" },
        linkedin: { type: String, default: "" },
        twitter: { type: String, default: "" },
        whatsapp: { type: String, default: "" },
        youtube: { type: String, default: "" },
    },
    { _id: false }
);

const notificationPreferencesSchema = new Schema(
    {
        coursePurchases: { type: Boolean, default: true },
        courseReviews: { type: Boolean, default: true },
        lectureComments: { type: Boolean, default: true },
        lectureNotesDownloads: { type: Boolean, default: true },
        commentReplies: { type: Boolean, default: true },
        dailyProfileVisits: { type: Boolean, default: true },
        lectureFileDownloads: { type: Boolean, default: true },
    },
    { _id: false }
);

const userSchema = new Schema(
    {
        name: {
            type: String,
            trim: true,
        },
        firstName: {
            type: String,
            required: [true, "First name is required"],
            trim: true,
        },
        lastName: {
            type: String,
            trim: true,
            default: "",
        },
        username: {
            type: String,
            required: [true, "Username is required"],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        passwordHash: {
            type: String,
            required: [true, "Password is required"],
        },
        avatar: {
            type: String,
            default: "",
        },
        bio: {
            type: String,
            default: "",
        },
        role: {
            type: String,
            enum: ["student", "instructor", "admin"],
            default: "student",
        },
        certifications: {
            type: [String],
            default: [],
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        socialLinks: {
            type: socialLinksSchema,
            default: () => ({}),
        },
        notificationPreferences: {
            type: notificationPreferencesSchema,
            default: () => ({}),
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Pre-save hook to auto-populate full name
userSchema.pre("save", function () {
    if (this.isModified("firstName") || this.isModified("lastName") || !this.name) {
        this.name = `${this.firstName || ""} ${this.lastName || ""}`.trim();
    }
});

// Virtual for avatarUrl alias
userSchema.virtual("avatarUrl")
    .get(function () {
        return this.avatar;
    })
    .set(function (url) {
        this.avatar = url;
    });

// Hash password before saving if modified
userSchema.pre("save", async function () {
    if (this.isModified("passwordHash")) {
        this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
});

// Method to compare entered password with passwordHash
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model("User", userSchema);
export default User;