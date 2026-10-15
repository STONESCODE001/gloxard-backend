import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Course } from '../models/Course.model.js';
import { User } from '../models/User.model.js';
import { Notification } from '../models/Notification.model.js';
import { Institution } from '../models/Institution.model.js';
import { Subscription } from '../models/Subscription.model.js';
import { sendSubscriptionReceiptEmail } from '../utils/email.js';

/**
 * Handles Paystack webhooks (e.g. charge.success) idempotently
 * POST /api/webhooks/paystack
 */
export const handlePaystackWebhook = async (req, res, next) => {
  try {
    const { event, data } = req.body || {};

    if (!event || !data) {
      return res.status(400).json({ error: 'Invalid webhook payload structure' });
    }

    // Ignore non-payment events
    if (event !== 'charge.success') {
      return res.status(200).json({
        status: 'success',
        message: 'Event ignored',
        event,
      });
    }

    if (!data.reference) {
      return res.status(400).json({ error: 'Invalid webhook payload structure' });
    }

    // Extract metadata
    const metadata = data.metadata || {};

    // Branch A: Institution Subscription Payment
    const isInstitutionSub =
      metadata.type === 'institution_subscription' ||
      metadata.institutionId ||
      metadata.institution_id;

    if (isInstitutionSub) {
      const institutionId = metadata.institutionId || metadata.institution_id;
      const institution = await Institution.findById(institutionId);
      if (!institution) {
        return res.status(404).json({ error: 'Institution not found for subscription webhook' });
      }

      const plan = metadata.plan || institution.plan || 'Premium';
      const billing = metadata.billing || institution.billing || 'monthly';
      const currency = data.currency || 'USD';
      const amountPaid = (data.amount || 0) / 100;
      const periodDays = billing === 'annual' ? 365 : 30;
      const periodStart = new Date();
      const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);

      const invoiceRecord = {
        invoiceId: `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        amount: amountPaid,
        currency,
        paidAt: new Date(),
        status: 'paid',
        receiptUrl: data.receipt_url || '',
      };

      // Upsert Subscription
      const subscription = await Subscription.findOneAndUpdate(
        { institutionId: institution._id },
        {
          institutionId: institution._id,
          plan,
          billing,
          currency,
          amountGross: metadata.amountGross || amountPaid,
          discount: metadata.discount || 0,
          amountTotal: amountPaid,
          status: 'active',
          provider: 'paystack',
          providerReference: data.reference,
          paystackSubscriptionCode: data.subscription_code || '',
          paystackEmailToken: data.email_token || '',
          periodStart,
          periodEnd,
          $push: { invoices: invoiceRecord },
        },
        { upsert: true, new: true }
      );

      // Transition Institution to active and advance wizard to step 6 (completed)
      institution.status = 'active';
      institution.plan = plan;
      institution.billing = billing;
      institution.seatLimit = plan === 'Enterprise' ? 5000 : 500;
      if (!institution.onboarding) {
        institution.onboarding = { currentStep: 6, completedSteps: [1, 2, 3, 4, 5, 6] };
      } else {
        if (!institution.onboarding.completedSteps.includes(5)) {
          institution.onboarding.completedSteps.push(5);
        }
        if (!institution.onboarding.completedSteps.includes(6)) {
          institution.onboarding.completedSteps.push(6);
        }
        institution.onboarding.currentStep = 6;
      }
      await institution.save();

      // Dispatch receipt email
      const adminUser = institution.adminUserId ? await User.findById(institution.adminUserId) : null;
      const recipientEmail = adminUser?.email || institution.representativeEmail;
      const recipientName = adminUser?.firstName || 'Administrator';

      sendSubscriptionReceiptEmail({
        to: recipientEmail,
        name: recipientName,
        institutionName: institution.name,
        plan,
        billing,
        amount: amountPaid,
        currency,
        reference: data.reference,
        receiptUrl: data.receipt_url || '',
      }).catch((e) => console.warn(`[SUBSCRIPTION RECEIPT EMAIL WARNING] ${e.message}`));

      return res.status(200).json({
        status: 'success',
        message: 'Institution subscription activated successfully',
        reference: data.reference,
        subscriptionId: subscription._id,
      });
    }

    // Branch B: Standard Student Course Enrollment Payment
    // Idempotency check: if transaction with this reference has already succeeded
    const existingTx = await Transaction.findOne({ reference: data.reference });
    if (existingTx && existingTx.status === 'success') {
      return res.status(200).json({
        status: 'success',
        message: 'Webhook already processed',
        reference: data.reference,
      });
    }

    const studentId = metadata.student_id || metadata.studentId || metadata.userId || metadata.user_id;
    const courseId = metadata.course_id || metadata.courseId;

    if (!studentId || !courseId) {
      return res.status(400).json({ error: 'Invalid webhook payload structure: missing metadata IDs' });
    }

    // Validate referenced student and course
    let student = null;
    if (mongoose.Types.ObjectId.isValid(studentId)) {
      student = await User.findById(studentId);
    }

    let course = null;
    if (mongoose.Types.ObjectId.isValid(courseId)) {
      course = await Course.findById(courseId);
    }
    if (!course) {
      course = await Course.findOne({ slug: courseId });
    }

    if (!student || !course) {
      return res.status(404).json({ error: 'Referenced user or course not found' });
    }

    // Revenue calculations (Paystack amount is in Kobo)
    const amountInNaira = (data.amount || 0) / 100;
    const instructorShare = amountInNaira * 0.70;
    const platformShare = amountInNaira * 0.30;

    // Upsert or create Transaction document
    const transaction = await Transaction.findOneAndUpdate(
      { reference: data.reference },
      {
        reference: data.reference,
        user: student._id,
        course: course._id,
        amount: amountInNaira,
        currency: data.currency || 'NGN',
        status: 'success',
        gatewayResponse: data,
        instructorShare,
        platformShare,
      },
      { upsert: true, new: true }
    );

    // Upsert Enrollment document
    const existingEnrollment = await Enrollment.findOne({ user: student._id, course: course._id });
    await Enrollment.findOneAndUpdate(
      { user: student._id, course: course._id },
      {
        user: student._id,
        course: course._id,
        enrolledAt: existingEnrollment ? existingEnrollment.enrolledAt : new Date(),
      },
      { upsert: true, new: true }
    );

    // Increment course enrollment tally if new enrollment
    if (!existingEnrollment) {
      await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } });
    }

    // Create student notification
    await Notification.create({
      recipient: student._id,
      title: 'Enrollment Confirmed',
      message: `You have successfully enrolled in ${course.title}.`,
      type: 'system',
      read: false,
      link: `/courses/${course.slug}`,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Webhook processed successfully',
      reference: data.reference,
      transactionId: transaction._id,
    });
  } catch (error) {
    next(error);
  }
};

export default { handlePaystackWebhook };
