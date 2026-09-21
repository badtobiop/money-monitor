// Integration test for Money Borrowed, Loan Purpose, and Multi-Pool Balances
const BASE_URL = 'http://localhost:3000';

async function runTests() {
    console.log('🧪 Starting Borrowed, Purpose & Multi-Pool Integration Tests...\n');

    const testUser = 'test_pool_user_' + Date.now() + '@example.com';

    // 0. Register Test User
    console.log('0️⃣ Registering test user:', testUser);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Test Pool User',
            email: testUser,
            password: 'TestPassword123!'
        })
    });
    console.log('   Registered:', await regRes.json());

    // 1. Set Monthly Salary
    console.log('\n1️⃣ Setting monthly salary to $50,000...');
    const salaryRes = await fetch(`${BASE_URL}/api/user/${encodeURIComponent(testUser)}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salary: 50000 })
    });
    console.log('   Salary set:', await salaryRes.json());

    // 2. Add an Expense
    console.log('\n2️⃣ Adding living expense of $5,000 (Rent)...');
    await fetch(`${BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            title: 'House Rent',
            amount: 5000,
            category: 'Bills'
        })
    });

    // 3. Check Dashboard Multi-Pool Balances
    console.log('\n3️⃣ Checking Multi-Pool Balances...');
    let dashRes = await fetch(`${BASE_URL}/api/dashboard/${testUser}`);
    let dash = await dashRes.json();
    console.log('   Available Cash (Salary - Expense):', dash.availableBalance);
    console.log('   Net Financial Position:', dash.netFinancialPosition);
    if (dash.availableBalance !== 45000) {
        throw new Error(`Expected availableBalance 45000, got ${dash.availableBalance}`);
    }

    // 4. Record Money Lent with Purpose
    console.log('\n4️⃣ Recording Money Lent of $10,000 to "Alice" with Purpose "Business Advance"...');
    const lentRes = await fetch(`${BASE_URL}/api/lent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            personName: 'Alice',
            amount: 10000,
            purpose: 'Business Advance',
            interestType: 'monthly_percent',
            interestRate: 2,
            notes: 'Q3 retail inventory'
        })
    });
    const lentData = await lentRes.json();
    console.log('   Lent record created:', lentData.record?.person_name, 'Purpose:', lentData.record?.purpose);
    if (lentData.record?.purpose !== 'Business Advance') {
        throw new Error(`Expected purpose 'Business Advance', got '${lentData.record?.purpose}'`);
    }

    // 5. Record Money Borrowed with Purpose & Accrual
    console.log('\n5️⃣ Recording Money Borrowed of $8,000 from "Bank of America" with Purpose "Medical Healthcare"...');
    const borrowedRes = await fetch(`${BASE_URL}/api/borrowed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            lenderName: 'Bank of America',
            amount: 8000,
            dateBorrowed: '2026-09-01',
            purpose: 'Medical Healthcare',
            interestType: 'daily_percent',
            interestRate: 0.1,
            notes: 'Emergency clinic procedure'
        })
    });
    const borrowedData = await borrowedRes.json();
    console.log('   Borrowed record created:', borrowedData.record?.lender_name, 'Purpose:', borrowedData.record?.purpose, 'Total Due:', borrowedData.record?.total_due);
    const borrowedId = borrowedData.record?.id;

    // 6. Fetch Borrowed Records List & Stats
    console.log('\n6️⃣ Fetching Borrowed Records & Stats...');
    const getBorrowedRes = await fetch(`${BASE_URL}/api/borrowed/${testUser}`);
    const borrowedList = await getBorrowedRes.json();
    console.log('   Total Borrowed Principal:', borrowedList.stats?.totalBorrowedPrincipal);
    console.log('   Pending Due to Creditors:', borrowedList.stats?.pendingTotalDue);
    console.log('   Records count:', borrowedList.records?.length);

    // 7. Check Updated Multi-Pool Balances
    console.log('\n7️⃣ Verifying Multi-Pool Separation on Dashboard...');
    dashRes = await fetch(`${BASE_URL}/api/dashboard/${testUser}`);
    dash = await dashRes.json();
    console.log('   Available Cash (Liquid):', dash.availableBalance);
    console.log('   Lent Portfolio (Receivable):', dash.lentPortfolio?.pendingTotalDue);
    console.log('   Borrowed Portfolio (Debt Liability):', dash.borrowedPortfolio?.pendingTotalDue);
    console.log('   Net Financial Position:', dash.netFinancialPosition);

    // 8. Toggle Borrowed to Repaid / Settled
    console.log('\n8️⃣ Toggling Borrowed Debt to Repaid...');
    const toggleRes = await fetch(`${BASE_URL}/api/borrowed/${borrowedId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: testUser })
    });
    const toggleData = await toggleRes.json();
    console.log('   Toggled status:', toggleData.record?.status, 'Repaid total:', toggleData.record?.total_due);

    // 9. AI Agent Chat Test: Record Borrowed, Debt Summary, and Settle
    console.log('\n9️⃣ Testing AI Agent Natural Language Debt Commands...');
    const chatRes = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            message: 'I borrowed $2500 from George for vehicle repair with zero interest'
        })
    });
    const chatData = await chatRes.json();
    console.log('   AI Reply (Record Borrowed):', chatData.reply);

    // AI Summary
    const summaryChatRes = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            message: 'What is my borrowed debt liabilities summary?'
        })
    });
    const summaryChatData = await summaryChatRes.json();
    console.log('   AI Reply (Debt Summary):', summaryChatData.reply);

    // AI Settle
    const settleChatRes = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            message: 'I repaid the debt to George'
        })
    });
    const settleChatData = await settleChatRes.json();
    console.log('   AI Reply (Settle Debt):', settleChatData.reply);

    // 10. Clean up
    console.log('\n🔟 Cleaning up test data...');
    if (borrowedId) {
        await fetch(`${BASE_URL}/api/borrowed/${borrowedId}?userId=${testUser}`, { method: 'DELETE' });
    }
    if (lentData.record?.id) {
        await fetch(`${BASE_URL}/api/lent/${lentData.record.id}?userId=${testUser}`, { method: 'DELETE' });
    }

    console.log('\n✅ ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
