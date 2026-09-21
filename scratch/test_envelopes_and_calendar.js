const BASE_URL = 'http://localhost:3000';
const USER_ID = 'test_user_' + Date.now();

async function runTests() {
    console.log('--- Testing Three-Envelope Capital Allocation System & Calendar API ---');

    // 1. Initial budget fetch (should return default with fallback to user's monthly_salary)
    const initialRes = await fetch(`${BASE_URL}/api/budget/${USER_ID}`);
    const initialData = await initialRes.json();
    console.log('1. Initial Budget:', initialData);

    // 2. Set monthly allocations
    // Gross: 50,000 | Expense Budget: 20,000 | Lending Budget: 10,000
    // Unallocated Reserve should be: 50,000 - 20,000 - 10,000 = 20,000
    const setRes = await fetch(`${BASE_URL}/api/budget/${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            month: '2026-09',
            grossIncome: 50000,
            expenseBudget: 20000,
            lentBudget: 10000
        })
    });
    const setData = await setRes.json();
    console.log('2. Set Allocations Result:', setData.budget);

    // 3. Add an expense (5,000)
    await fetch(`${BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: USER_ID,
            title: 'Groceries & Provisions',
            amount: 5000,
            category: 'Food'
        })
    });
    console.log('3. Added expense ₹5,000');

    // 4. Add a lent record (4,000)
    await fetch(`${BASE_URL}/api/lent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: USER_ID,
            personName: 'Rohan Sharma',
            amount: 4000,
            purpose: 'Emergency Medical',
            interestType: 'simple',
            interestRate: 2
        })
    });
    console.log('4. Lent ₹4,000 to Rohan Sharma');

    // 5. Fetch updated budget status
    const updatedRes = await fetch(`${BASE_URL}/api/budget/${USER_ID}/2026-09`);
    const updatedData = await updatedRes.json();
    const b = updatedData.budget;
    console.log('5. Updated Envelope Status:');
    console.log(`- Gross Income: ₹${b.grossIncome}`);
    console.log(`- Living Expenses Budget: ₹${b.expenseEnvelope.budget}, Spent: ₹${b.expenseEnvelope.spent}, Remaining: ₹${b.expenseEnvelope.remaining}`);
    console.log(`- Lending Fund Budget: ₹${b.lendingEnvelope.fundBudget}, Active Lent: ₹${b.lendingEnvelope.activeLent}, Remaining Limit: ₹${b.lendingEnvelope.remainingCapacity}`);
    console.log(`- Unallocated Reserve: ₹${b.unallocatedReserve}`);
    console.log(`- Total Retained Liquid: ₹${b.totalRetainedLiquid}`);

    // 6. Test Calendar Month Archive endpoint
    const calRes = await fetch(`${BASE_URL}/api/calendar/${USER_ID}/2026-09`);
    const calData = await calRes.json();
    console.log('6. Calendar Month Data:');
    console.log(`- Month: ${calData.data.month}`);
    console.log(`- Total Expense: ₹${calData.data.totals.totalExpense}`);
    console.log(`- Total Lent: ₹${calData.data.totals.totalLent}`);
    console.log(`- Days with Activity: ${Object.keys(calData.data.days).length}`);

    // Verification asserts
    if (b.expenseEnvelope.remaining === 15000 &&
        b.lendingEnvelope.remainingCapacity === 6000 &&
        calData.data.totals.totalExpense === 5000 &&
        calData.data.totals.totalLent === 4000) {
        console.log('\n🎉 ALL ENVELOPE & CALENDAR BACKEND TESTS PASSED SUCCESSFULLY!');
    } else {
        console.error('\n❌ Mismatch in calculations!', b, calData.data.totals);
    }
}

runTests().catch(console.error);
