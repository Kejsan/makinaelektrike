
const stripMarkdown = (text: string): string => {
  return text
    .replace(/^```[a-z]*\n([\s\S]*?)\n```$/i, '$1') // Full-block match with newline
    .replace(/^```[a-z]*\s*([\s\S]*?)\s*```$/i, '$1') // Single line or tight block
    .trim();
};

const testCases = [
    {
        name: "Standard Markdown Block",
        input: '```json\n{"brand": "BYD", "model_name": "SEALION 7"}\n```',
        expected: '{"brand": "BYD", "model_name": "SEALION 7"}'
    },
    {
        name: "Markdown Block without language",
        input: '```\n{"brand": "BYD"}\n```',
        expected: '{"brand": "BYD"}'
    },
    {
        name: "Tight Markdown Block",
        input: '```json{"brand": "BYD"}```',
        expected: '{"brand": "BYD"}'
    },
    {
        name: "Raw JSON",
        input: '{"brand": "BYD"}',
        expected: '{"brand": "BYD"}'
    }
];

let allPassed = true;
testCases.forEach(tc => {
    const result = stripMarkdown(tc.input);
    if (result === tc.expected) {
        console.log(`PASS: ${tc.name}`);
    } else {
        console.log(`FAIL: ${tc.name}`);
        console.log(`  Expected: ${tc.expected}`);
        console.log(`  Received: ${result}`);
        allPassed = false;
    }
    
    try {
        JSON.parse(result);
        console.log(`  JSON.parse: OK`);
    } catch (e) {
        console.log(`  JSON.parse: FAILED (${e.message})`);
        allPassed = false;
    }
});

if (allPassed) {
    console.log("\nALL CORE LOGIC TESTS PASSED!");
} else {
    console.log("\nSOME TESTS FAILED!");
    process.exit(1);
}
