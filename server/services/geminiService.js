/**
 * High-speed AI Service powered by Groq LPU Inference Engine.
 * Re-exports all methods for complete backward compatibility across all modules.
 */
import groqService from './groqService.js';

export const analyzeEmail = groqService.analyzeEmail;
export const fastClassifyEmail = groqService.fastClassifyEmail;
export const generateCustomReply = groqService.generateCustomReply;
export const callGroqWithFallback = groqService.callGroqWithFallback;

export default groqService;
