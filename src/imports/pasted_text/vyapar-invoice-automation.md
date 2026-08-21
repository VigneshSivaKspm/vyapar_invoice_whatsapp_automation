Vyapar Invoice Automation – Technical Concept & Development Workflow
1. Project Concept
The client is already using Vyapar for their billing operations. We are not planning to replace Vyapar or develop a complete new billing system.
Our proposed solution is to develop a separate LMV Invoice Automation System that works alongside the existing Vyapar software.
The main purpose is to automate:
Invoice Detection → Customer Identification → WhatsApp Invoice Sending
The system will also provide a simple option for sending festival and offer messages to customers.

2. Main Requirement
The client will continue using Vyapar normally.
The proposed workflow is:
Vyapar → Invoice Download → LMV Background Agent → Invoice Processing → WhatsApp → Customer
When the staff generates and downloads an invoice from Vyapar, our system should automatically detect the new invoice and send it to the customer's WhatsApp.
The staff should not have to manually upload every invoice into our system.

3. Complete Invoice Workflow
Step 1 – Generate Invoice in Vyapar
The staff will continue creating invoices normally in Vyapar.
Example:
Customer: Vignesh
Mobile: 9876543210
Invoice No: INV-1025
Amount: ₹1,000
Step 2 – Download Invoice
The staff downloads the invoice from Vyapar.
The invoice PDF will be saved in the computer's:
Downloads Folder / Configured Invoice Folder

Step 3 – Background Agent Detects Invoice
A lightweight Node.js Windows Background Agent will continuously monitor the configured folder.
When a new PDF is downloaded:
New Invoice Detected
The staff does not need to open our application or upload the invoice manually.

Step 4 – Read Invoice
The Node.js agent will process the PDF and extract the required information:
•	Customer Name
•	Customer Mobile Number
•	Invoice Number
•	Invoice Date
•	Invoice Amount
•	Invoice PDF
The first preference will be normal PDF text extraction.
If the actual Vyapar invoice is image-based and text cannot be extracted, an OCR solution can be considered as a fallback.

Step 5 – Send Information to Backend
After extracting the invoice information, the Node.js Background Agent will securely send the data to our Node.js Backend API.
The backend will process the invoice and communicate with Firebase.
Step 6 – Firebase
Firebase / Firestore will maintain the application records.
It can store:
•	Invoice details
•	Customer details
•	Processing status
•	WhatsApp status
•	Campaign information
•	Message logs
If required, Firebase Storage can be used for invoice PDF storage.

Step 7 – Duplicate Check
Before sending the invoice, the backend will check whether the invoice has already been processed.
Example:
INV-1025 → Already Sent
If already sent:
Do Not Send Again
If not sent:
Continue to WhatsApp
This is required to prevent duplicate messages.






Step 8 – WhatsApp
The backend will use the official WhatsApp Business / WhatsApp Cloud API to send the invoice.
Example:
Dear Vignesh,
Thank you for shopping with us.
Please find your invoice attached.
Invoice No: INV-1025
Amount: ₹1,000
Thank you for your valuable support.
Invoice PDF → Attached

Step 9 – Save Status
After sending, the backend will update Firebase.
Example:
Invoice: INV-1025
Customer: Vignesh
Mobile: 9876543210
Status: SENT
Date/Time: 21-Aug-2026 10:30 PM
If sending fails:
Status: FAILED
The reason can also be stored.






4. Complete Technical Architecture
The complete system will be developed without Python.
Frontend
React + Vite
Used for the admin dashboard.
Backend
Node.js
Used for:
•	APIs
•	Invoice processing
•	WhatsApp integration
•	Authentication logic
•	Duplicate checking
•	Campaign management
•	Error handling
Local Windows Application
Node.js Windows Background Agent
Used for:
•	Monitoring the invoice/download folder
•	Detecting new PDFs
•	Reading invoice PDFs
•	Extracting information
•	Sending invoice data to the backend
•	Retry handling
Database / Backend Services
Firebase
Mainly:
•	Firebase Authentication
•	Firestore
•	Firebase Storage, if required
WhatsApp
Official WhatsApp Business / Cloud API
Used for:
•	Invoice messages
•	Invoice PDF sending
•	Festival/offer messages
5. Overall System Workflow
                         VYAPAR
                            │
                            │
                     Generate Invoice
                            │
                            ▼
                       Invoice PDF
                            │
                            ▼
                Download / Invoice Folder
                            │
                            ▼
             ┌──────────────────────────┐
             │ Node.js Background Agent │
             │      Windows App         │
             └────────────┬─────────────┘
                          │
                          ▼
                    Detect New PDF
                          │
                          ▼
                   Read Invoice PDF
                          │
                          ▼
                 Extract Invoice Data
                          │
                          ▼
                  Node.js Backend API
                          │
                          ▼
                       Firebase
                          │
                    Check Duplicate
                          │
                          ▼
                WhatsApp Cloud API
                          │
                          ▼
                  Customer WhatsApp
                          │
                          ▼
                  Save Delivery Status
6. Vyapar Integration Options
There are two practical approaches we should investigate.
Option 1 – Official Vyapar API
We can check whether the client's Vyapar version/account provides an official API that allows access to:
•	Invoice information
•	Customer information
•	Mobile number
•	Invoice details
If a suitable official API is available, direct integration can be considered.
However, we should not promise direct API integration until it is technically confirmed.

Option 2 – Downloaded Invoice Automation
This is the recommended approach for the current project.
We do not need to modify Vyapar.
The workflow will simply be:
Vyapar
↓
Download Invoice
↓
Invoice PDF
↓
Node.js Background Agent
↓
Process Invoice
↓
Node.js Backend
↓
Firebase
↓
WhatsApp
This allows the client to continue using Vyapar exactly as they currently do.

7. Why We Prefer the Folder Automation Approach
The client already has:
•	Vyapar
•	Products
•	Customers
•	Existing billing setup
•	Existing staff workflow
Therefore, we should avoid changing their billing process.
The background application should work silently.
The client simply continues:
Create Bill → Download Bill
Everything after that should happen automatically.

8. Important Technical Validation
We should obtain around 5–10 sample invoices and verify:
1.	Customer name availability.
2.	Customer mobile number availability.
3.	Invoice number format.
4.	Invoice date.
5.	PDF structure.
6.	Whether the PDF contains selectable text.
7.	Exact download location.
8.	Whether all billing computers use the same invoice format.
Most important:
We need to confirm whether the customer's mobile number is available in the downloaded invoice PDF.
If it is not available, we need another way to map the invoice/customer to the mobile number.
9. Festival / Offer Messaging
The second requirement is a simple facility for sending festival or promotional messages.
Examples:
•	Deepavali
•	Pongal
•	Ramzan
•	Independence Day
•	New Year
•	Store Offers
•	Special Promotions
The admin can create a campaign.
Example:
Campaign: Deepavali 2026
Message:
Happy Diwali, {{customer_name}}!
Wishing you and your family a very Happy Diwali.
Visit our store and enjoy our special Diwali offers.
Thank you for shopping with us.
The system can replace:
{{customer_name}}
with the actual customer name.





10. Simple Admin Panel
The admin panel should be simple and focused on the required features.
Login
•	Admin Login
•	Password
•	Logout
Dashboard
•	Total Invoices
•	Sent Invoices
•	Pending Invoices
•	Failed Invoices
•	Today's Invoices
•	Today's WhatsApp Messages
Invoice History
•	Invoice Number
•	Customer Name
•	Mobile Number
•	Amount
•	Date
•	Status
Festival Campaigns
•	Create Campaign
•	Enter Message
•	Select Customers
•	Preview
•	Send
•	Campaign History
11. Duplicate Prevention
The system must ensure that the same invoice is not sent multiple times.
Example:
Invoice INV-1025
       ↓
Already Processed?
       ↓
      YES
       ↓
Do Not Send
The backend should maintain a unique invoice/processing record in Firebase.

12. Internet Failure
If the billing computer temporarily loses internet:
Invoice Downloaded
       ↓
Node.js Agent Detects Invoice
       ↓
Internet Unavailable
       ↓
Save as Pending
       ↓
Internet Available
       ↓
Send to Backend
       ↓
Continue WhatsApp Processing
The invoice should not be lost because of temporary network issues.
13. WhatsApp Failure
If WhatsApp sending fails:
Invoice
   ↓
WhatsApp API
   ↓
FAILED
The system should store:
•	Invoice Number
•	Customer
•	Error
•	Failed Time
•	Status
A retry option can be provided.
14. Multiple Billing Computers
If the client generates invoices from multiple computers, the Node.js Background Agent can be installed on each required billing computer.
Example:
Billing PC 1 ─┐
Billing PC 2 ─┤
Billing PC 3 ─┤
Billing PC 4 ─┘
              │
              ▼
       Node.js Backend
              │
              ▼
           Firebase
              │
              ▼
      WhatsApp Cloud API
This should be confirmed with the client before implementation.
15. Firebase Structure
A basic Firestore structure can contain:
Users
users
 └── userId
      ├── name
      ├── email
      ├── role
      └── createdAt
Invoices
invoices
 └── invoiceId
      ├── invoiceNumber
      ├── customerName
      ├── mobileNumber
      ├── amount
      ├── invoiceDate
      ├── fileName
      ├── status
      ├── whatsappMessageId
      ├── createdAt
      └── sentAt
Campaigns
campaigns
 └── campaignId
      ├── name
      ├── message
      ├── status
      ├── createdAt
      └── sentAt
The exact Firebase structure can be finalized during development.





16. Node.js Background Agent
The local Node.js application should:
•	Start automatically with Windows.
•	Run in the background.
•	Monitor the configured folder.
•	Detect new invoice PDFs.
•	Wait until the PDF is completely downloaded.
•	Extract invoice information.
•	Communicate with the Node.js backend.
•	Handle temporary network failures.
•	Avoid processing the same invoice twice.
The client should not need to manually open the application every time.

17. Node.js Backend
The Node.js backend should handle:
•	API communication
•	Authentication
•	Invoice processing
•	Firebase/Firestore operations
•	Duplicate checking
•	WhatsApp API integration
•	Campaign management
•	Message status
•	Error handling
•	Retry handling
The local Windows agent should only handle the local computer-side work.

18. Security
The application will handle customer information and invoice information.
Therefore:
•	Use HTTPS.
•	Secure API endpoints.
•	Use Firebase Authentication.
•	Apply Firestore security rules.
•	Do not expose WhatsApp API credentials in the frontend.
•	Do not store sensitive credentials directly in source code.
•	Validate data received from the local agent.
•	Protect customer information.

19. Third-Party Charges
The development cost and third-party charges should be separate.
The client will be responsible for applicable charges such as:
•	WhatsApp/Meta messaging charges
•	WhatsApp Business account-related charges
•	Hosting charges, if applicable
•	Domain charges
•	OCR/API charges, if required
•	Other third-party service charges
These should not be included in the development cost unless specifically agreed.





20. Development Priority
Phase 1 – Technical Validation
•	Collect actual Vyapar invoices.
•	Check invoice PDF structure.
•	Check mobile number availability.
•	Identify download folder.
•	Test PDF extraction.
•	Check WhatsApp API requirements.
Phase 2 – Invoice Automation
•	Node.js Windows Agent
•	Folder monitoring
•	PDF detection
•	PDF data extraction
•	Node.js backend
•	Firebase integration
•	Duplicate checking
•	WhatsApp sending
Phase 3 – Admin Panel
•	Login
•	Dashboard
•	Invoice history
•	Status management
•	Failed invoice view
Phase 4 – Festival Messaging
•	Campaign creation
•	Message/template
•	Customer selection
•	WhatsApp sending
•	Campaign history
Phase 5 – Testing & Deployment
•	Multiple invoice testing
•	Duplicate testing
•	Internet failure testing
•	WhatsApp failure testing
•	Windows restart testing
•	Client computer installation
•	Final client testing

21. Final Recommended Workflow
The final proposed solution is:
Vyapar
↓
Generate & Download Invoice
↓
Invoice PDF
↓
Node.js Windows Background Agent
↓
Detect New Invoice
↓
Extract Customer & Invoice Information
↓
Node.js Backend
↓
Firebase / Firestore
↓
Duplicate Check
↓
WhatsApp Cloud API
↓
Customer WhatsApp
↓
Save Sent/Failed Status

22. Final Understanding
The objective of this project is not to replace Vyapar.
The objective is to automate the repetitive work after billing.
The client's workflow remains:
Create Bill → Download Bill
Our system handles the remaining process automatically:
Detect Bill → Read Bill → Identify Customer → Send WhatsApp → Save Status
Along with this, the client will have a simple admin panel to send festival and promotional WhatsApp messages such as Deepavali, Pongal, Ramzan, Independence Day and New Year messages.
