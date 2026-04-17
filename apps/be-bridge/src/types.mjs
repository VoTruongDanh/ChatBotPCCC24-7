/**
 * Type definitions for be-bridge
 * 
 * These types define the contract between be-main and be-bridge
 * for easy integration with other systems.
 */

/**
 * @typedef {Object} Rule
 * @property {string} id - Unique identifier
 * @property {string} name - Rule name
 * @property {'system'|'context'|'instruction'} type - Rule type
 * @property {string} content - Rule content
 * @property {number} priority - Priority (lower = higher priority)
 * @property {boolean} active - Is rule active
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} [prompt] - Single prompt text
 * @property {Array<{role: string, content: string}>} [messages] - Message history
 * @property {Array<Rule>} [rules] - Rules to inject into prompt
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} response - Full response text
 * @property {string} [workerId] - Worker ID that handled the request
 */

/**
 * @typedef {Object} StreamDelta
 * @property {string} delta - Text chunk
 */

/**
 * @typedef {Object} StreamDone
 * @property {boolean} done - Always true
 * @property {string} response - Full response text
 */

/**
 * @typedef {Object} StreamError
 * @property {string} error - Error message
 */

/**
 * @typedef {Object} HealthResponse
 * @property {'ok'} status - Service status
 * @property {number} workers - Total workers
 * @property {number} available - Available workers
 * @property {number} generating - Busy workers
 */

/**
 * @typedef {Object} WorkerInfo
 * @property {string} id - Worker ID
 * @property {boolean} busy - Is worker busy
 */

// Export empty object for ES module
export default {};
