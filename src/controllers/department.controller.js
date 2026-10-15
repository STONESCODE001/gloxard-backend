import { Department } from "../models/Department.model.js";
import { InstitutionMember } from "../models/InstitutionMember.model.js";
import { Institution } from "../models/Institution.model.js";

/**
 * GET /api/institutions/me/departments
 * Step 2: Lists all departments scoped to req.institutionId.
 */
export const getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find({ institutionId: req.institutionId }).sort({ createdAt: -1 });

    return res.status(200).json({
      departments,
      count: departments.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/institutions/me/departments
 * Step 2: Creates new department. Enforces unique code and plan department limit (10 for Premium).
 */
export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, faculty, headName, description } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Department name is required",
        code: "VALIDATION_ERROR",
      });
    }

    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        error: "Department code is required",
        code: "VALIDATION_ERROR",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Check duplicate code within tenant
    const existingCode = await Department.findOne({
      institutionId: req.institutionId,
      code: normalizedCode,
    });

    if (existingCode) {
      return res.status(409).json({
        error: `Department with code '${normalizedCode}' already exists in this institution`,
        code: "DUPLICATE_DEPARTMENT_CODE",
      });
    }

    // Check plan limits
    const institution = await Institution.findById(req.institutionId);
    const plan = institution?.plan || "Premium";

    if (plan === "Premium") {
      const currentDeptCount = await Department.countDocuments({ institutionId: req.institutionId });
      if (currentDeptCount >= 10) {
        return res.status(400).json({
          error: "Department limit of 10 reached for Premium plan. Upgrade to Enterprise for unlimited departments.",
          code: "DEPARTMENT_LIMIT_EXCEEDED",
        });
      }
    }

    const department = await Department.create({
      institutionId: req.institutionId,
      name: name.trim(),
      code: normalizedCode,
      faculty: faculty ? String(faculty).trim() : "",
      headName: headName ? String(headName).trim() : "",
      description: description ? String(description).trim() : "",
    });

    // Advance onboarding step 2
    if (institution) {
      if (!institution.onboarding) {
        institution.onboarding = { currentStep: 3, completedSteps: [1, 2] };
      } else {
        if (!institution.onboarding.completedSteps.includes(2)) {
          institution.onboarding.completedSteps.push(2);
        }
        if (institution.onboarding.currentStep === 2) {
          institution.onboarding.currentStep = 3;
        }
      }
      await institution.save();
    }

    return res.status(201).json({
      message: "Department created successfully",
      department,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Department code already exists in this institution",
        code: "DUPLICATE_DEPARTMENT_CODE",
      });
    }
    next(error);
  }
};

/**
 * PUT /api/institutions/me/departments/:id
 * Step 2: Updates department metadata.
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, faculty, headName, description } = req.body || {};

    const department = await Department.findOne({
      _id: id,
      institutionId: req.institutionId,
    });

    if (!department) {
      return res.status(404).json({
        error: "Department not found",
        code: "DEPARTMENT_NOT_FOUND",
      });
    }

    if (code) {
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode !== department.code) {
        const codeCollision = await Department.findOne({
          institutionId: req.institutionId,
          code: normalizedCode,
          _id: { $ne: id },
        });
        if (codeCollision) {
          return res.status(409).json({
            error: `Department code '${normalizedCode}' already exists in this institution`,
            code: "DUPLICATE_DEPARTMENT_CODE",
          });
        }
        department.code = normalizedCode;
      }
    }

    if (name) department.name = name.trim();
    if (faculty !== undefined) department.faculty = String(faculty).trim();
    if (headName !== undefined) department.headName = String(headName).trim();
    if (description !== undefined) department.description = String(description).trim();

    await department.save();

    return res.status(200).json({
      message: "Department updated successfully",
      department,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/institutions/me/departments/:id
 * Step 2: Deletes department (safeguarded against assigned members).
 */
export const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const department = await Department.findOne({
      _id: id,
      institutionId: req.institutionId,
    });

    if (!department) {
      return res.status(404).json({
        error: "Department not found",
        code: "DEPARTMENT_NOT_FOUND",
      });
    }

    // Safeguard: block deletion if members are assigned to this department
    const assignedMembersCount = await InstitutionMember.countDocuments({
      institutionId: req.institutionId,
      departmentIds: id,
    });

    if (assignedMembersCount > 0) {
      return res.status(409).json({
        error: "Cannot delete department with assigned members. Please reassign members before deleting.",
        code: "DEPARTMENT_HAS_MEMBERS",
        assignedMembersCount,
      });
    }

    await Department.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Department deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
