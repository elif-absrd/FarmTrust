/**
 * Simulate INR conversion via Ramp (mocked)
 * @param {object} params
 * @returns {Promise<object>}
 */
async function simulateRampConversion(params) {
  const referenceId = `RAMP-${Date.now()}`;
  console.log("💱 Simulated Ramp conversion:", { referenceId, ...params });
  return { referenceId, status: "SIMULATED" };
}

module.exports = { simulateRampConversion };
