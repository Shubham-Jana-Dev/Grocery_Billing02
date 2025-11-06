// Data Array - এখন এটি Firebase থেকে আসা ডেটা রাখবে
let transactions = [];
let deletedTransactions = []; // New array for deleted history
let currentUser = null; // To store current logged-in user info

// Member List - (Used for display and calculation)
const members = ["Shubham Jana", "Krishna Kumar", "Suvajit Jana"];
// Mapping email to display name for auto-selection (Case-insensitive)
const memberEmailMap = {
    "krishnak97235@gmail.com": "Krishna Kumar",
    "jsuvajit124@gmail.com": "Suvajit Jana",
    "shubhamjana87@gmail.com": "Shubham Jana",
};


// --- 0. One-time Whitelist Initialization ---

/*
    *** গুরুত্বপূর্ণ: একবার সফলভাবে চালানো হলে এটি ডিলিট বা কমেন্ট করে দিন ***
    এই ফাংশনটি শুধুমাত্র একবার allowed_users নোডটি ডেটাবেসে তৈরি করার জন্য।
    Security Rules ঠিকভাবে সেট করা থাকলে এটি দ্বিতীয়বার কাজ করবে না (যা ভালো)।
*/
function initAllowedUsers() {
    console.log("Attempting to initialize allowed_users whitelist...");
    
    const whitelistData = {
        "krishnak97235@gmail,com": true,
        "jsuvajit124@gmail,com": true,
        "shubhamjana87@gmail,com": true
    };

    allowedUsersRef.set(whitelistData)
        .then(() => {
            console.log("Whitelist initialized successfully. You can now comment out this function call.");
        })
        .catch(error => {
            console.error("Whitelist initialization failed. Check your database permissions or if the node already exists.", error);
        });
}


// --- 1. Authentication and UI Control ---

document.getElementById('signInBtn').addEventListener('click', signInWithGoogle);
document.getElementById('signOutBtn').addEventListener('click', signOut);

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(error => {
            // Handle Errors here.
            console.error("Google Sign-in failed:", error);
            alert(`Sign-in failed: ${error.message}`);
        });
}

function signOut() {
    auth.signOut()
        .then(() => {
            console.log("User signed out.");
        })
        .catch(error => {
            console.error("Sign-out failed:", error);
        });
}

// Auth State Listener
auth.onAuthStateChanged(user => {
    currentUser = user;
    const userStatus = document.getElementById('userStatus');
    const mainContent = document.getElementById('mainContent');
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const paidByDisplay = document.getElementById('paidByDisplay');

    if (user) {
        // Check if user is in the member list
        const displayName = memberEmailMap[user.email.toLowerCase()];

        if (displayName) {
            // Logged in AND Whitelisted User
            userStatus.textContent = `Signed in as: ${displayName} (${user.email})`;
            signInBtn.style.display = 'none';
            signOutBtn.style.display = 'block';
            mainContent.style.display = 'block';
            
            // Set Auto Paid By Field
            document.getElementById('paidBy').value = displayName;
            paidByDisplay.value = displayName;
            
            // Load and render data only for authenticated users
            loadTransactions(); 
            loadDeletedHistory();
            
        } else {
            // Logged in BUT NOT Whitelisted User
            userStatus.textContent = `Access Denied. Your email (${user.email}) is not authorized. Please sign out.`;
            signInBtn.style.display = 'none';
            signOutBtn.style.display = 'block';
            mainContent.style.display = 'none';
            alert("Your email is not on the allowed list. Access denied.");
            auth.signOut(); // Force sign out non-whitelisted user (Optional, but safer)
        }

    } else {
        // Not Logged In
        userStatus.textContent = 'Please sign in to access the tracker.';
        signInBtn.style.display = 'block';
        signOutBtn.style.display = 'none';
        mainContent.style.display = 'none';
        transactions = []; // Clear data when logged out
        deletedTransactions = [];
        renderHistory();
        renderDeletedHistory();
        calculateSettlement();
    }
});


// --- 2. Data Management (Load/Save using Firebase) ---

function loadTransactions() {
    transactionsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        transactions = [];

        if (data) {
            Object.keys(data).forEach(key => {
                transactions.push({ id: key, ...data[key] }); 
            });
        }
        
        renderHistory();
        calculateSettlement();
        console.log("Transactions loaded.");
    }, error => {
        console.error("Firebase read failed: ", error);
    });
}

function loadDeletedHistory() {
    deletedRef.on('value', (snapshot) => {
        const data = snapshot.val();
        deletedTransactions = [];
        
        if (data) {
            Object.keys(data).forEach(key => {
                deletedTransactions.push({ id: key, ...data[key] }); 
            });
        }
        renderDeletedHistory();
        console.log("Deleted history loaded.");
    }, error => {
        console.error("Deleted history read failed: ", error);
    });
}

function addTransactionToDB(newTransaction) {
    transactionsRef.push(newTransaction)
        .catch(error => {
            console.error("Error adding transaction: ", error);
            alert("Failed to save data. Check Security Rules or connectivity.");
        });
}


// --- 3. Expense Entry ---

document.getElementById('expenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (!currentUser || !memberEmailMap[currentUser.email.toLowerCase()]) {
        alert("You must be logged in and authorized to add an expense.");
        return;
    }
    
    // 1. Collect Form Data
    const date = document.getElementById('date').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paidBy = document.getElementById('paidBy').value; // Auto-set name
    const description = document.getElementById('description').value;

    // 2. Collect Shared By Data
    const sharedBy = [];
    if (document.getElementById('shareShubhamJana').checked) sharedBy.push('Shubham Jana');
    if (document.getElementById('shareKrishnaKumar').checked) sharedBy.push('Krishna Kumar');
    if (document.getElementById('shareSuvajitJana').checked) sharedBy.push('Suvajit Jana');

    if (sharedBy.length === 0) {
        alert("At least one member must share the cost.");
        return;
    }

    // 3. ডেটাবেসে নতুন ট্রানজাকশন যোগ
    const newTransaction = { 
        date, 
        amount, 
        paidBy, 
        description, 
        sharedBy, 
        timestamp: Date.now(),
        payer_uid: currentUser.uid, // Store the UID for secure deletion
        payer_email: currentUser.email // Store email for logging
    };
    addTransactionToDB(newTransaction); 
    
    // 4. ফর্মটি রিসেট
    this.reset(); 
    // Re-set the auto-filled fields
    document.getElementById('paidBy').value = memberEmailMap[currentUser.email.toLowerCase()];
    document.getElementById('paidByDisplay').value = memberEmailMap[currentUser.email.toLowerCase()];
});


// --- 4. History Display and Deletion ---

function renderHistory() {
    const table = document.getElementById('historyTable');
    const currentUID = currentUser ? currentUser.uid : null;
    
    // Updated Headers: Added a column for the Delete button
    table.innerHTML = `<tr><th>Date</th><th>Description</th><th>Amount</th><th>Paid By</th><th>Shared By</th><th>Action</th></tr>`;
    
    transactions.sort((a, b) => b.timestamp - a.timestamp); 

    transactions.forEach(t => {
        const row = table.insertRow();
        row.insertCell().textContent = t.date;
        row.insertCell().textContent = t.description;
        row.insertCell().textContent = t.amount.toFixed(2);
        row.insertCell().textContent = t.paidBy;
        row.insertCell().textContent = t.sharedBy ? t.sharedBy.join(', ') : ''; 
        
        // Add Delete Button cell
        const actionCell = row.insertCell();
        
        // Check if the current user is the payer (Payer UID matches current user UID)
        if (currentUID && t.payer_uid === currentUID) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '❌';
            deleteBtn.title = 'Delete this expense';
            deleteBtn.onclick = () => deleteTransaction(t.id, t);
            actionCell.appendChild(deleteBtn);
        } else {
            actionCell.textContent = '---';
        }
    });
}

function deleteTransaction(transactionId, transactionData) {
    if (!currentUser) {
        alert("You must be logged in to delete a transaction.");
        return;
    }

    if (!confirm(`Are you sure you want to delete the expense: ${transactionData.description} (${transactionData.amount} Taka)?`)) {
        return;
    }
    
    // 1. Log the deletion event before deleting the original transaction
    const deletedRecord = {
        ...transactionData,
        deletedBy: currentUser.email,
        deletedAt: Date.now()
    };
    
    deletedRef.push(deletedRecord)
        .then(() => {
            console.log("Deletion logged successfully.");
            
            // 2. Remove the original transaction from the main node
            transactionsRef.child(transactionId).remove()
                .then(() => {
                    alert(`Expense deleted successfully by ${memberEmailMap[currentUser.email.toLowerCase()]}.`);
                })
                .catch(error => {
                    console.error("Error removing transaction:", error);
                    alert("Failed to delete transaction. Check Security Rules (must match payer_uid).");
                });
        })
        .catch(error => {
            console.error("Error logging deletion:", error);
            alert("Failed to log deletion history.");
        });
}

function renderDeletedHistory() {
    const table = document.getElementById('deletedHistoryTable');
    // Clear old data and add headers
    table.innerHTML = `<tr><th>Date</th><th>Description</th><th>Amount</th><th>Deleted By</th><th>Deleted At</th></tr>`;
    
    // Sort transactions by deletion time (newest first)
    deletedTransactions.sort((a, b) => b.deletedAt - a.deletedAt); 

    deletedTransactions.forEach(t => {
        const row = table.insertRow();
        row.insertCell().textContent = t.date;
        row.insertCell().textContent = t.description;
        row.insertCell().textContent = t.amount.toFixed(2);
        row.insertCell().textContent = t.deletedBy;
        row.insertCell().textContent = new Date(t.deletedAt).toLocaleString();
    });
}


// --- 5. Settlement Calculation (No change to logic) ---

function calculateSettlement() {
    let totalPaid = {};
    let netBalance = {};
    members.forEach(m => {
        totalPaid[m] = 0;
        netBalance[m] = 0;
    });

    // A. Calculate Total Paid and Net Balance for each member
    transactions.forEach(t => {
        // Total Paid by member
        totalPaid[t.paidBy] += t.amount;
        
        // Calculate individual share for this expense
        const numShared = t.sharedBy.length;
        if (numShared > 0) {
            const sharePerPerson = t.amount / numShared;
            
            // Adjust Net Balance for those who shared the expense
            t.sharedBy.forEach(member => {
                // Member owes their share (negative balance)
                netBalance[member] -= sharePerPerson; 
            });
        }
        
        // The member who paid gets credit (positive balance)
        netBalance[t.paidBy] += t.amount;
    });

    // B. Render Overall Net Result
    const resultDiv = document.getElementById('settlementResult');
    resultDiv.innerHTML = '<h3>Net Balance (Who Owes/Receives)</h3>';
    
    let payers = [];
    let recipients = [];
    let totalExpense = 0;

    members.forEach(member => {
        const balance = netBalance[member];
        const amountDisplay = Math.abs(balance).toFixed(2);
        
        const p = document.createElement('p');
        
        if (balance > 0.01) {
            p.innerHTML = `${member}: Paid ${totalPaid[member].toFixed(2)} Taka. Net Result: <span class="positive">Receives ${amountDisplay} Taka</span>`;
            recipients.push({ name: member, amount: balance });
        } else if (balance < -0.01) {
            p.innerHTML = `${member}: Paid ${totalPaid[member].toFixed(2)} Taka. Net Result: <span class="negative">Owes ${amountDisplay} Taka</span>`;
            payers.push({ name: member, amount: Math.abs(balance) });
        } else {
            p.textContent = `${member}: Paid ${totalPaid[member].toFixed(2)} Taka. Net Result: Neutral.`;
        }
        resultDiv.appendChild(p);
        
        totalExpense += totalPaid[member];
    });
    
    // Add total expense for context
    const totalP = document.createElement('p');
    totalP.innerHTML = `<strong>Total Group Expense: ${totalExpense.toFixed(2)} Taka</strong>`;
    resultDiv.prepend(totalP);


    // C. Calculate and Render payment instructions
    renderPaymentInstructions(payers, recipients);
}

// Function to simplify the "Who pays whom"
function renderPaymentInstructions(payers, recipients) {
    const instructionsDiv = document.getElementById('paymentInstructions');
    instructionsDiv.innerHTML = '<h3>Simplified Payment Instructions</h3>';
    
    const ul = document.createElement('ul');
    instructionsDiv.appendChild(ul);
    
    if (payers.length === 0 && recipients.length === 0) {
        ul.innerHTML = '<li>All accounts are settled!</li>';
        return;
    }
    
    payers.sort((a, b) => b.amount - a.amount);
    recipients.sort((a, b) => b.amount - a.amount);
    
    let i = 0; 
    let j = 0; 

    while (i < payers.length && j < recipients.length) {
        const payer = payers[i];
        const recipient = recipients[j];

        const amountToTransfer = Math.min(payer.amount, recipient.amount);
        
        if (amountToTransfer > 0.01) {
            const li = document.createElement('li');
            li.textContent = `${payer.name} pays ${recipient.name} ${amountToTransfer.toFixed(2)} Taka.`;
            ul.appendChild(li);
        }

        payer.amount -= amountToTransfer;
        recipient.amount -= amountToTransfer;

        if (payer.amount < 0.01) {
            i++;
        }
        if (recipient.amount < 0.01) {
            j++;
        }
    }
}

// --- 6. Utility Functions ---

function clearAllData() {
    if (!currentUser || !memberEmailMap[currentUser.email.toLowerCase()]) {
        alert("You must be an authorized member and logged in to perform this action.");
        return;
    }

    if (confirm("Are you sure you want to clear ALL transaction data? This cannot be undone.")) {
        // Firebase থেকে সব ডেটা সরিয়ে দিন
        transactionsRef.remove()
            .then(() => {
                alert("All data has been cleared from the database.");
            })
            .catch(error => {
                console.error("Error clearing data: ", error);
                alert("Failed to clear data.");
            });
    }
}


// --- 7. Initialization ---

function init() {
    // initAllowedUsers(); // <--- Uncomment this line, run the app once successfully, then comment it out again.
}

init();
