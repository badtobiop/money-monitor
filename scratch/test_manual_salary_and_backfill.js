const BASE_URL = 'http://localhost:3000';

async function runTest() {
    console.log('--- Testing Manual Salary Per Month & Last Month Backfill ---');
    const testUser = `manual_salary_user_${Date.now()}`;

    // 1. Check September 2026 initially (New user, no salary set yet)
    const initSepRes = await fetch(`${BASE_URL}/api/budget/${testUser}/2026-09`);
    const initSepData = await initSepRes.json();
    console.log('1. Initial September 2026 (Should be 0, not auto-fixed):', {
        grossIncome: initSepData.budget.grossIncome,
        rolloverSavings: initSepData.budget.rolloverSavings,
        liveAvailableSalary: initSepData.budget.liveAvailableSalary
    });

    if (initSepData.budget.grossIncome !== 0) {
        throw new Error(`Expected September grossIncome to be 0 for new user, but got ${initSepData.budget.grossIncome}`);
    }
    console.log('✅ PASS: No automatic fixed salary inserted on new month!');

    // 2. User backfills Last Month (August 2026)
    // Add August Salary = 5000
    const setAugRes = await fetch(`${BASE_URL}/api/user/${testUser}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salary: 5000, mode: 'set', month: '2026-08' })
    });
    const setAugData = await setAugRes.json();
    console.log('2. Backfilled August 2026 Salary:', setAugData);

    // Add August Expense = 2000
    await fetch(`${BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: testUser,
            title: 'August Rent & Food',
            amount: 2000,
            category: 'Food',
            date: '2026-08-10'
        })
    });
    console.log('   Added August expense: ₹2,000. Leftover should be ₹3,000.');

    // 3. Check September 2026 now:
    // August leftover ₹3,000 should roll over!
    // September salary should STILL be 0 (user must add September salary manually!)
    const sepAfterAugRes = await fetch(`${BASE_URL}/api/budget/${testUser}/2026-09`);
    const sepAfterAugData = await sepAfterAugRes.json();
    console.log('3. September after August backfill:', {
        month: sepAfterAugData.budget.month,
        grossIncome: sepAfterAugData.budget.grossIncome,
        rolloverSavings: sepAfterAugData.budget.rolloverSavings,
        totalAvailableCapital: sepAfterAugData.budget.totalAvailableCapital,
        liveAvailableSalary: sepAfterAugData.budget.liveAvailableSalary
    });

    if (sepAfterAugData.budget.grossIncome !== 0) {
        throw new Error(`Expected September grossIncome to remain 0 until manually set, got ${sepAfterAugData.budget.grossIncome}`);
    }
    if (sepAfterAugData.budget.rolloverSavings !== 3000) {
        throw new Error(`Expected rolloverSavings 3000 from August, got ${sepAfterAugData.budget.rolloverSavings}`);
    }
    if (sepAfterAugData.budget.liveAvailableSalary !== 3000) {
        throw new Error(`Expected available balance 3000, got ${sepAfterAugData.budget.liveAvailableSalary}`);
    }
    console.log('✅ PASS: August leftover ₹3,000 rolled over into September, while September salary remained ₹0 waiting for manual entry!');

    // 4. Now User manually adds September's salary: ₹5,000
    const setSepRes = await fetch(`${BASE_URL}/api/user/${testUser}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salary: 5000, mode: 'set', month: '2026-09' })
    });
    const setSepData = await setSepRes.json();
    console.log('4. Manually added September 2026 Salary:', setSepData);

    // 5. Check September again: Total should be 5000 + 3000 = 8000
    const finalSepRes = await fetch(`${BASE_URL}/api/budget/${testUser}/2026-09`);
    const finalSepData = await finalSepRes.json();
    console.log('5. Final September Budget:', {
        grossIncome: finalSepData.budget.grossIncome,
        rolloverSavings: finalSepData.budget.rolloverSavings,
        totalAvailableCapital: finalSepData.budget.totalAvailableCapital,
        liveAvailableSalary: finalSepData.budget.liveAvailableSalary
    });

    if (finalSepData.budget.totalAvailableCapital !== 8000) {
        throw new Error(`Expected September totalAvailableCapital to be 8000, got ${finalSepData.budget.totalAvailableCapital}`);
    }
    console.log('✅ PASS: September total is ₹5,000 (salary) + ₹3,000 (rollover) = ₹8,000!');

    // 6. Check October 2026 (Future month): Should start with grossIncome = 0
    const octRes = await fetch(`${BASE_URL}/api/budget/${testUser}/2026-10`);
    const octData = await octRes.json();
    console.log('6. October 2026 (Future month):', {
        grossIncome: octData.budget.grossIncome,
        rolloverSavings: octData.budget.rolloverSavings,
        totalAvailableCapital: octData.budget.totalAvailableCapital
    });

    if (octData.budget.grossIncome !== 0) {
        throw new Error(`Expected October grossIncome to be 0 until manually set, got ${octData.budget.grossIncome}`);
    }
    console.log('✅ PASS: Future months strictly require manual salary entry and do not auto-populate fixed salaries!');

    console.log('\n🎉 ALL MANUAL SALARY & BACKFILL TESTS PASSED SUCCESSFULLY!');
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
