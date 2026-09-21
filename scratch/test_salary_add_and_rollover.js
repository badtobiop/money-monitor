const BASE_URL = 'http://localhost:3000';

async function runTest() {
    console.log('--- Testing Add Money to Salary & Monthly Rollover System ---');
    const testUser = `rollover_test_${Date.now()}`;

    // 1. Initial Salary = 5000 (mode: 'set')
    const setRes = await fetch(`${BASE_URL}/api/user/${testUser}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salary: 5000, mode: 'set' })
    });
    const setData = await setRes.json();
    console.log('1. Set initial salary:', setData);

    // 2. Add 200 (mode: 'add') -> Should become 5200!
    const addRes = await fetch(`${BASE_URL}/api/user/${testUser}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salary: 200, mode: 'add' })
    });
    const addData = await addRes.json();
    console.log('2. Add 200 to salary result:', addData);

    if (addData.salary !== 5200) {
        throw new Error(`Expected salary 5200, but got ${addData.salary}`);
    }
    console.log('✅ PASS: Salary 5000 + 200 = 5200 successfully added!');

    // 3. Test Previous Month Rollover (Set August 2026 budget to 5000)
    await fetch(`${BASE_URL}/api/budget/${testUser}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            month: '2026-08',
            grossIncome: 5000,
            expenseBudget: 2000,
            lentBudget: 1000
        })
    });

    // Add 2000 expense in August 2026
    await fetch(`${BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            title: 'August Shopping',
            amount: 2000,
            category: 'Shopping',
            date: '2026-08-15'
        })
    });
    console.log('3. Set August 2026: Salary ₹5,000, Expense ₹2,000 (Leftover = ₹3,000)');

    // 4. Fetch September 2026 budget
    const septRes = await fetch(`${BASE_URL}/api/budget/${testUser}/2026-09`);
    const septData = await septRes.json();
    console.log('4. September 2026 Budget Status:', {
        month: septData.budget.month,
        grossIncome: septData.budget.grossIncome,
        rolloverSavings: septData.budget.rolloverSavings,
        totalAvailableCapital: septData.budget.totalAvailableCapital,
        liveAvailableSalary: septData.budget.liveAvailableSalary
    });

    if (septData.budget.rolloverSavings !== 3000) {
        throw new Error(`Expected rolloverSavings 3000, but got ${septData.budget.rolloverSavings}`);
    }
    console.log('✅ PASS: Exactly ₹3,000 unspent from August automatically rolled over into September!');

    // 5. Check Dashboard available balance
    const dashRes = await fetch(`${BASE_URL}/api/dashboard/${testUser}`);
    const dashData = await dashRes.json();
    console.log('5. Dashboard Available Balance:', dashData.availableBalance, 'Rollover:', dashData.rolloverSavings);

    console.log('\n🎉 ALL SALARY ADD & ROLLOVER TESTS PASSED SUCCESSFULLY!');
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
