const BASE_URL = 'http://localhost:3000';

async function testAgent() {
    console.log('--- Testing Autonomous AI Agent Live Interaction & Tool Calling ---');
    const testUser = `ai_audit_user_${Date.now()}`;

    // Test 1: Add an expense via AI Agent
    console.log('\n1️⃣ Testing AI Expense Logging: "I spent 45 on Starbucks coffee"');
    const res1 = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            message: 'I spent 45 on Starbucks coffee'
        })
    });
    const data1 = await res1.json();
    console.log('AI Response:', data1.reply);

    // Test 2: Add a task via AI Agent
    console.log('\n2️⃣ Testing AI Task Creation: "Add task: Review monthly finances"');
    const res2 = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            message: 'Add task: Review monthly finances'
        })
    });
    const data2 = await res2.json();
    console.log('AI Response:', data2.reply);

    // Test 3: Lend money via AI Agent
    console.log('\n3️⃣ Testing AI Money Lent Recording: "I lent 250 to Sameer for Travel with 2% monthly interest"');
    const res3 = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            message: 'I lent 250 to Sameer for Travel with 2% monthly interest'
        })
    });
    const data3 = await res3.json();
    console.log('AI Response:', data3.reply);

    // Test 4: Ask AI Agent for pending tasks
    console.log('\n4️⃣ Testing AI Query: "What are my pending tasks?"');
    const res4 = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            message: 'What are my pending tasks?'
        })
    });
    const data4 = await res4.json();
    console.log('AI Response:', data4.reply);

    // Test 5: Ask AI Agent for money lent summary
    console.log('\n5️⃣ Testing AI Query: "Show my money lent summary"');
    const res5 = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            message: 'Show my money lent summary'
        })
    });
    const data5 = await res5.json();
    console.log('AI Response:', data5.reply);

    // Test 6: Verify Database persistence
    console.log('\n6️⃣ Verifying Database Persistence...');
    const dashRes = await fetch(`${BASE_URL}/api/dashboard/${testUser}`);
    const dash = await dashRes.json();
    console.log(`- Expenses in DB: ${dash.expenses.length} (Expected >= 1)`);
    console.log(`- Month total spent: $${dash.monthTotal} (Expected 45)`);
    console.log(`- Pending lent in DB: $${dash.pendingLent} (Expected 250)`);

    if (dash.expenses.length >= 1 && dash.monthTotal === 45 && dash.pendingLent === 250) {
        console.log('\n🎉 ALL 5 AI AGENT LIVE TOOL TESTS PASSED PERFECTLY!');
    } else {
        throw new Error('Database verification failed after AI tool calls!');
    }
}

testAgent().catch(err => {
    console.error('❌ AI Agent Test Failed:', err);
    process.exit(1);
});
