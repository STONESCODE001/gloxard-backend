import mongoose from 'mongoose';
import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';

export const checkEnrollment = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.body.courseId;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID parameter is required' });
    }

    let course = null;
    if (mongoose.Types.ObjectId.isValid(courseId)) {
      course = await Course.findById(courseId);
    }
    if (!course) {
      course = await Course.findOne({ slug: courseId });
    }

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Attach resolved course to request object
    req.course = course;

    // Admins and course instructors bypass the student enrollment check
    if (req.user) {
      if (req.user.role === 'admin') {
        return next();
      }
      if (course.instructor && course.instructor.toString() === req.user._id.toString()) {
        return next();
      }
    }

    // Verify student active enrollment
    const enrollment = await Enrollment.findOne({
      user: req.user._id,
      course: course._id,
    });

    if (!enrollment) {
      return res.status(403).json({
        error: 'You must be enrolled in this course to access learning content',
      });
    }

    req.enrollment = enrollment;
    next();
  } catch (error) {
    next(error);
  }
};

export default checkEnrollment;
