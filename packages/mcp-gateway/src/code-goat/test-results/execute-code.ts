// Execute a short long-running operation
console.log("Starting long-running operation...");
const opResult = await mcpTools.longRunningOperation({
  duration: 3,
  steps: 5
});
console.log("Long-running operation result:", opResult);

// Get first tiny image (red)
console.log("\nGetting first tiny image (red)...");
const image1 = await mcpTools.getTinyImage({
  color: "red",
  size: "small"
});
console.log("First image received");

// Get second tiny image (blue)
console.log("\nGetting second tiny image (blue)...");
const image2 = await mcpTools.getTinyImage({
  color: "blue",
  size: "small"
});
console.log("Second image received");

// Concatenate the base64 strings
console.log("\nConcatenating images...");
const concatenated = image1.image + image2.image;
console.log("Concatenated length:", concatenated.length);
console.log("First 100 chars:", concatenated.substring(0,
100));

console.log("\n✓ All operations completed successfully!");