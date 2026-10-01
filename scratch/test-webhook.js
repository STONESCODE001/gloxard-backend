import crypto from 'crypto';
import express from 'express';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Course } from '../src/models/Course.model.js';
import { Transaction } from '../src/models/Transaction.model.js';
import { Enrollment } from '../src/models/Enrollment.model.js';
import { Notification } from '../src/models/Notification.model.js';
import { env } from '../src/config/env.js';

const MONGODB_URI = env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gloxad_test_webhook';
const SECRET = env.PAYSTACK_SECRET_KEY || 'sk_test_mock_paystack_secret_key_12345';

async function runTests() {
  console.log('🚀 Starting Unit 11 Webhook Verification Tests...');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Start express server on random port
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    console.log(`✅ Server running at ${baseUrl}`);

    // Create test student and course
    const testStudent = await User.create({
      firstName: 'Webhook',
      lastName: 'Student',
      email: `webhook_student_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'student',
      isEmailVerified: true,
      approvalStatus: 'approved'
    });

    const testCourse = await Course.create({
      title: `Webhook Course ${Date.now()}`,
      slug: `webhook-course-${Date.now()}`,
      subtitle: 'Webhook test course',
      description: 'Course for testing webhook processing',
      instructor: testStudent._id,
      category: new mongoose.Types.ObjectId(),
      courseType: 'paid',
      price: 25000,
      status: 'published',
      enrolledCount: 0
    });

    console.log('✅ Created test user and test course');

    // Test Helper
    const sendWebhook = async (headers, bodyObj) => {
      const bodyStr = JSON.stringify(bodyObj);
      const res = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: bodyStr
      });
      const data = await res.json();
      return { status: res.status, data };
    };

    const computeSig = (payloadObj) => {
      return crypto
        .createHmac('sha512', SECRET)
        .update(JSON.stringify(payloadObj))
        .digest('hex');
    };

    // 1. Missing Signature Test
    console.log('\n--- Test 1: Missing Signature ---');
    const res1 = await sendWebhook({}, { event: 'charge.success' });
    console.log('Res 1:', res1);
    if (res1.status === 401 && res1.data.error === 'Invalid Paystack signature') {
      console.log('PASS Test 1: Missing signature rejected with 401');
    } else {
      throw new Error('FAIL Test 1');
    }

    // 2. Invalid Signature Test
    console.log('\n--- Test 2: Invalid Signature ---');
    const res2 = await sendWebhook({ 'x-paystack-signature': 'invalid_signature_hex' }, { event: 'charge.success' });
    console.log('Res 2:', res2);
    if (res2.status === 401 && res2.data.error === 'Invalid Paystack signature') {
      console.log('PASS Test 2: Invalid signature rejected with 401');
    } else {
      throw new Error('FAIL Test 2');
    }

    // 3. Ignored Event Test
    console.log('\n--- Test 3: Ignored Event ---');
    const payload3 = { event: 'transfer.success', data: { reference: 'REF_TRANSFER_1' } };
    const sig3 = computeSig(payload3);
    const res3 = await sendWebhook({ 'x-paystack-signature': sig3 }, payload3);
    console.log('Res 3:', res3);
    if (res3.status === 200 && res3.data.status === 'success' && res3.data.message === 'Event ignored') {
      console.log('PASS Test 3: Non-charge.success event ignored with 200 OK');
    } else {
      throw new Error('FAIL Test 3');
    }

    // 4. Valid charge.success Initial Event Test
    console.log('\n--- Test 4: Valid Initial Event ---');
    const testRef = `PAYSTACK_REF_${Date.now()}`;
    const payload4 = {
      event: 'charge.success',
      data: {
        id: 100200300,
        domain: 'test',
        status: 'success',
        reference: testRef,
        amount: 2500000, // 25,000 NGN in Kobo
        currency: 'NGN',
        metadata: {
          student_id: testStudent._id.toString(),
          course_id: testCourse._id.toString()
        },
        customer: {
          email: testStudent.email
        }
      }
    };
    const sig4 = computeSig(payload4);
    const res4 = await sendWebhook({ 'x-paystack-signature': sig4 }, payload4);
    console.log('Res 4:', res4);

    if (res4.status === 200 && res4.data.status === 'success' && res4.data.reference === testRef) {
      console.log('PASS Test 4 response status and reference');
    } else {
      throw new Error('FAIL Test 4 response');
    }

    // Verify DB records for Test 4
    const tx = await Transaction.findOne({ reference: testRef });
    console.log('DB Tx:', tx);
    if (tx && tx.status === 'success' && tx.amount === 25000 && tx.instructorShare === 17500 && tx.platformShare === 7500) {
      console.log('PASS Test 4 Transaction record (70/30 share verified)');
    } else {
      throw new Error('FAIL Test 4 Transaction DB record');
    }

    const enrollment = await Enrollment.findOne({ user: testStudent._id, course: testCourse._id });
    console.log('DB Enrollment:', enrollment);
    if (enrollment) {
      console.log('PASS Test 4 Enrollment created');
    } else {
      throw new Error('FAIL Test 4 Enrollment DB record');
    }

    const updatedCourse = await Course.findById(testCourse._id);
    console.log('Updated Course enrolledCount:', updatedCourse.enrolledCount);
    if (updatedCourse.enrolledCount === 1) {
      console.log('PASS Test 4 course enrolledCount incremented by 1');
    } else {
      throw new Error('FAIL Test 4 course enrolledCount');
    }

    const notification = await Notification.findOne({ recipient: testStudent._id });
    console.log('Notification:', notification);
    if (notification && notification.title === 'Enrollment Confirmed') {
      console.log('PASS Test 4 student notification created');
    } else {
      throw new Error('FAIL Test 4 notification');
    }

    // 5. Idempotent Replay Test
    console.log('\n--- Test 5: Idempotent Replay ---');
    const res5 = await sendWebhook({ 'x-paystack-signature': sig4 }, payload4);
    console.log('Res 5:', res5);
    if (res5.status === 200 && res5.data.message === 'Webhook already processed') {
      console.log('PASS Test 5 idempotent response');
    } else {
      throw new Error('FAIL Test 5 response');
    }

    const recheckCourse = await Course.findById(testCourse._id);
    if (recheckCourse.enrolledCount === 1) {
      console.log('PASS Test 5 enrolledCount remained 1 (no double increment)');
    } else {
      throw new Error('FAIL Test 5 double increment bug');
    }

    const txCount = await Transaction.countDocuments({ reference: testRef });
    if (txCount === 1) {
      console.log('PASS Test 5 no duplicate Transaction created');
    } else {
      throw new Error('FAIL Test 5 duplicate Transaction');
    }

    // 6. Invalid Metadata Reference Test
    console.log('\n--- Test 6: Invalid Metadata Reference ---');
    const fakeId = new mongoose.Types.ObjectId().toString();
    const payload6 = {
      event: 'charge.success',
      data: {
        reference: `PAYSTACK_REF_FAKE_${Date.now()}`,
        amount: 500000,
        metadata: {
          student_id: fakeId,
          course_id: testCourse._id.toString()
        }
      }
    };
    const sig6 = computeSig(payload6);
    const res6 = await sendWebhook({ 'x-paystack-signature': sig6 }, payload6);
    console.log('Res 6:', res6);
    if (res6.status === 404 && res6.data.error === 'Referenced user or course not found') {
      console.log('PASS Test 6 non-existent user/course returned 404');
    } else {
      throw new Error('FAIL Test 6 invalid reference');
    }

    console.log('\n🎉 ALL UNIT 11 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
