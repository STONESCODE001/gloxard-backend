import bcrypt from "bcryptjs";

export const hashValue = async (plainText, saltRounds = 10) => {
  return await bcrypt.hash(String(plainText), saltRounds);
};

export const compareValue = async (plainText, hashedValue) => {
  return await bcrypt.compare(String(plainText), String(hashedValue));
};

export default {
  hashValue,
  compareValue,
};
