import { Subscription } from "../models/Subscription.model.js";
import { Institution } from "../models/Institution.model.js";
import { initializeSubscriptionTransaction } from "../utils/paystack.js";

// Canonical Pricing Structure (Server-Enforced)
const PRICING = {
  Premium: {
    monthly: { amount: 249.0, discount: 0, total: 249.0 },
    annual: { amount: 2988.0, discount: 597.6, total: 2390.4 },
  },
  Enterprise: {
    monthly: { amount: 599.0, discount: 0, total: 599.0 },
    annual: { amount: 7188.0, discount: 1437.6, total: 5750.4 },
  },
};

/**
 * POST /api/institutions/me/subscription/checkout
 * Step 5: Computes canonical price and initializes Paystack recurring checkout.
 */
export const createCheckout = async (req, res, next) => {
  try {
    const institution = await Institution.findById(req.institutionId);
    if (!institution) {
      return res.status(404).json({
        error: "Institution workspace not found",
        code: "INSTITUTION_NOT_FOUND",
      });
    }

    const {
      plan = institution.plan || "Premium",
      billing = institution.billing || "monthly",
      currency = "USD",
    } = req.body || {};

    if (!["Premium", "Enterprise"].includes(plan)) {
      return res.status(400).json({
        error: "Invalid subscription plan. Choose 'Premium' or 'Enterprise'",
        code: "VALIDATION_ERROR",
      });
    }

    if (!["monthly", "annual"].includes(billing)) {
      return res.status(400).json({
        error: "Invalid billing cycle. Choose 'monthly' or 'annual'",
        code: "VALIDATION_ERROR",
      });
    }

    const priceInfo = PRICING[plan][billing];
    const grossAmount = priceInfo.amount;
    const discount = priceInfo.discount;
    const total = priceInfo.total;

    // Currency conversion if NGN is requested (1 USD = 1500 NGN reference rate)
    const normalizedCurrency = currency.toUpperCase() === "NGN" ? "NGN" : "USD";
    const chargeTotal = normalizedCurrency === "NGN" ? Math.round(total * 1500) : total;

    // Initialize Paystack checkout
    const checkoutResult = await initializeSubscriptionTransaction({
      email: req.user.email,
      amount: chargeTotal,
      currency: normalizedCurrency,
      plan,
      billing,
      institutionId: institution._id,
      grossAmount,
      discount,
    });

    // Advance onboarding step 5
    if (!institution.onboarding) {
      institution.onboarding = { currentStep: 6, completedSteps: [5] };
    } else {
      if (!institution.onboarding.completedSteps.includes(5)) {
        institution.onboarding.completedSteps.push(5);
      }
      if (institution.onboarding.currentStep === 5) {
        institution.onboarding.currentStep = 6;
      }
    }

    institution.plan = plan;
    institution.billing = billing;
    institution.seatLimit = plan === "Enterprise" ? 5000 : 500;
    await institution.save();

    return res.status(200).json({
      reference: checkoutResult.reference,
      access_code: checkoutResult.access_code,
      checkoutUrl: checkoutResult.checkoutUrl,
      amount: grossAmount,
      currency: normalizedCurrency,
      discount,
      total: chargeTotal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/institutions/me/subscription
 * Fetches active subscription details, renewal date, and invoice history.
 */
export const getSubscription = async (req, res, next) => {
  try {
    const institution = await Institution.findById(req.institutionId);
    if (!institution) {
      return res.status(404).json({
        error: "Institution workspace not found",
        code: "INSTITUTION_NOT_FOUND",
      });
    }

    const subscription = await Subscription.findOne({
      institutionId: req.institutionId,
    });

    if (!subscription) {
      return res.status(200).json({
        subscription: null,
        plan: institution.plan,
        billing: institution.billing,
        status: "incomplete",
        seatLimit: institution.seatLimit,
        invoices: [],
      });
    }

    return res.status(200).json({
      subscription,
      plan: subscription.plan,
      billing: subscription.billing,
      status: subscription.status,
      renewalDate: subscription.periodEnd,
      invoices: subscription.invoices || [],
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createCheckout,
  getSubscription,
};
