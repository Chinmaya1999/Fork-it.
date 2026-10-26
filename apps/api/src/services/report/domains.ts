// Domain profiles: typical problem statements, modules, test scenarios and future scope for each kind of project.
// These are TYPICAL for the domain and are always labelled as such in the report; they are never presented as verified facts about a specific project.
import type { ReportProject } from './types.js';

export interface Domain {
  key: string; name: string; background: string[]; problem: string[]; existing: string[]; proposedBenefits: string[]; objectives: string[]; actors: string[]; modules: string[]; entities: string[];
  tests: [string, string, string][]; // feature, input/steps, expected result
  future: string[]; limitations: string[];
}

const mgmtTests: Domain['tests'] = [
  ['Registration', 'Submit the registration form with valid details', 'Account is created and a success message is shown'],
  ['Registration', 'Submit with an e-mail that already exists', 'Registration is rejected with a clear "already registered" message'],
  ['Login', 'Enter a valid username and password', 'User is redirected to the dashboard for their role'],
  ['Login', 'Enter a valid username with a wrong password', 'Login fails with a generic error; no account details are revealed'],
  ['Access control', 'Open an administrator page while logged in as a normal user', 'Access is denied (403) or the user is redirected'],
  ['Add record', 'Fill all mandatory fields and save', 'Record is stored and appears in the list'],
  ['Validation', 'Leave a mandatory field empty and save', 'Form is not submitted and the field is highlighted with a message'],
  ['Validation', 'Enter text in a numeric field / invalid e-mail format', 'Input is rejected with a descriptive message'],
  ['Search', 'Search for an existing record by a keyword', 'Matching records are displayed'],
  ['Search', 'Search for a keyword that matches nothing', 'An empty-state message is shown, no error occurs'],
  ['Update record', 'Edit an existing record and save', 'Changes are saved and visible immediately'],
  ['Delete record', 'Delete a record and confirm', 'Record is removed after confirmation; cancelling keeps it'],
  ['Duplicate prevention', 'Add a record whose unique field already exists', 'System prevents the duplicate and explains why'],
  ['Report', 'Generate the report for a date range', 'Report shows correct totals for that range'],
  ['Session', 'Click logout, then press the browser Back button', 'Protected pages are not accessible without logging in again'],
  ['Password', 'Change the password and log in again', 'Old password no longer works; new password works'],
  ['Responsiveness', 'Open the main pages on a phone-sized screen', 'Layout adapts without horizontal scrolling'],
  ['Data persistence', 'Restart the server/application and reopen the data', 'Previously saved records are still present'],
];
const generic = (key: string, name: string, over: Partial<Domain>): Domain => ({
  key, name,
  background: [`In many organisations and institutions, information is still maintained in registers, spreadsheets or loosely connected tools. As the volume of data grows, this approach makes it slow to find information, easy to introduce errors and hard to produce accurate reports. Software systems built for a specific purpose automate routine work, keep data in one consistent place and make it available to authorised people whenever it is needed.`, `Advances in web, mobile and database technologies have made it practical to build such systems at low cost using open-source tools. This project applies those technologies to a concrete problem and documents the analysis, design, implementation and testing of the solution.`],
  problem: ['Manual or fragmented handling of information leads to duplicated effort, delays, inconsistent records and difficulty in generating reports. Users have no single reliable place to store, search and update the information they depend on, and there is limited control over who can see or change it.'],
  existing: ['Data is stored in paper registers or isolated spreadsheets, so searching is slow.', 'The same information is entered several times, which causes inconsistencies.', 'There is no role-based control over who may view or modify data.', 'Reports must be prepared by hand and are prone to calculation errors.', 'Information is difficult to share between people and departments.'],
  proposedBenefits: ['All data is stored centrally and consistently in a database.', 'Fast search and filtering of records.', 'Role-based access improves accountability and security.', 'Reports and summaries are generated automatically and accurately.', 'The interface is simple enough for non-technical users to learn quickly.'],
  objectives: ['To study the existing process and identify its limitations.', 'To design a system that stores and retrieves information reliably through a database.', 'To provide secure authentication and role-based access to the system.', 'To implement the main functions of the system with validated input and clear feedback.', 'To test the system systematically and document the results.'],
  actors: ['Administrator', 'Registered user'],
  modules: ['Authentication and authorisation', 'User and role management', 'Core data management (add, view, update, delete)', 'Search and filtering', 'Reports and dashboard'],
  entities: ['User', 'Role', 'Primary business record(s) of the application', 'Transaction / activity log'],
  tests: mgmtTests,
  future: ['Mobile application or progressive web app for access on the move.', 'E-mail and SMS notifications for important events.', 'Advanced analytics and graphical dashboards.', 'Integration with external systems through APIs.', 'Multi-language support and improved accessibility.', 'Automated backups and cloud deployment with monitoring.'],
  limitations: ['The system has been tested with limited data volumes and a small number of concurrent users.', 'Advanced features such as real-time notifications and detailed analytics are not included in the current version.', 'Offline operation is not supported unless stated otherwise.'],
  ...over,
});

export const DOMAINS: Domain[] = [
  generic('ecommerce', 'E-commerce / online shopping', {
    background: ['Online shopping lets customers browse products, compare prices and place orders from anywhere at any time. E-commerce systems connect product catalogues, shopping carts, order processing and payment gateways, and give sellers tools to manage inventory and fulfilment.'],
    problem: ['Small sellers often lack an affordable online storefront, and customers lack a convenient way to browse, order and track purchases. Manual order handling is slow and error-prone.'],
    actors: ['Customer', 'Administrator / seller'], modules: ['User registration and login', 'Product catalogue and search', 'Shopping cart', 'Checkout and order placement', 'Payment (sandbox or gateway)', 'Order tracking', 'Admin product, stock and order management'],
    entities: ['User', 'Product', 'Category', 'Cart / cart item', 'Order / order item', 'Payment', 'Address'],
    tests: [['Catalogue', 'Open the product list', 'Products are listed with name, price and image'], ['Search', 'Search for a product name', 'Matching products are shown'], ['Cart', 'Add a product to the cart', 'Cart count and total update'], ['Cart', 'Change quantity to 0 / remove item', 'Item is removed and total recalculated'], ['Checkout', 'Place an order with valid address', 'Order is created with a unique order number'], ['Stock', 'Order more than the available stock', 'System prevents the order and shows an error'], ['Payment', 'Complete a test payment', 'Order is marked paid only after confirmation'], ['Order history', 'Open "My orders"', 'Only the logged-in user\'s orders are shown'], ...mgmtTests.slice(0, 6)],
    future: ['Product reviews and ratings.', 'Recommendation engine.', 'Coupons and discounts.', 'Delivery tracking integration.', 'Mobile application.'],
  }),
  generic('mobile', 'Mobile application', {
    background: ['Smartphones are the primary computing device for many users. Mobile applications can use device features such as the camera, GPS, notifications and local storage to deliver convenient, always-available services.'],
    problem: ['Users need a quick, convenient way to perform tasks on the move. Web-only or manual solutions are inconvenient on small screens and do not use device capabilities.'],
    actors: ['User', 'Administrator (where applicable)'], modules: ['Splash screen and onboarding', 'Registration and login', 'Main feature screens', 'Local storage / cloud synchronisation', 'Notifications', 'Settings and profile'],
    entities: ['User', 'Primary data item(s) of the app', 'Settings / preferences'],
    tests: [['Install and launch', 'Install the app and open it', 'App launches without crashing and shows the first screen'], ['Login', 'Sign in with valid credentials', 'Home screen is shown'], ['Login', 'Sign in with invalid credentials', 'Error message is displayed'], ['Core feature', 'Perform the main action of the app', 'Result is displayed and saved'], ['Validation', 'Submit a form with empty mandatory fields', 'Validation messages appear'], ['Rotation', 'Rotate the device during use', 'State is preserved and layout adapts'], ['Offline', 'Disable the network and use the app', 'App shows a clear offline message or works from local data'], ['Permissions', 'Deny a requested permission', 'App degrades gracefully and explains what is unavailable'], ['Back navigation', 'Use the back button across screens', 'Navigation behaves predictably'], ['Data persistence', 'Close and reopen the app', 'Saved data is still available']],
    future: ['Push notifications.', 'Dark mode and accessibility improvements.', 'Cloud backup and multi-device sync.', 'Biometric authentication.', 'Publishing to an app store.'],
    limitations: ['The application was tested on a limited set of devices and OS versions.', 'Advanced offline synchronisation is not included unless stated.'],
  }),
  generic('ml', 'Machine learning / data science', {
    background: ['Machine learning enables computers to learn patterns from data and make predictions without being explicitly programmed for every case. Applications range from recommendation and classification to forecasting and image or text understanding.'],
    problem: ['Large amounts of data are collected but not fully used. Manual analysis is slow and subjective, and simple rules cannot capture complex patterns. A trained model can provide faster and more consistent predictions.'],
    existing: ['Decisions rely on manual inspection or simple rules.', 'Analysis of large datasets is slow.', 'Results vary between people.', 'There is no systematic evaluation of accuracy.', 'Insights are not available in an easy-to-use interface.'],
    proposedBenefits: ['Automated, repeatable predictions.', 'Quantified performance using standard metrics.', 'Faster analysis of large datasets.', 'Easy-to-use interface for non-technical users.', 'Model can be retrained as new data arrives.'],
    actors: ['End user', 'Data scientist / administrator'], modules: ['Data collection and loading', 'Data cleaning and preprocessing', 'Feature engineering', 'Model training', 'Model evaluation', 'Prediction interface (web, desktop or notebook)'],
    entities: ['Dataset', 'Feature', 'Trained model', 'Prediction result'],
    tests: [['Data loading', 'Load the dataset file', 'Rows and columns are read correctly'], ['Missing values', 'Provide data with missing values', 'Values are handled (imputed or removed) without error'], ['Training', 'Train the model on the training split', 'Training completes and the model is saved'], ['Evaluation', 'Evaluate on the test split', 'Accuracy / precision / recall / F1 are reported'], ['Prediction', 'Predict a known sample', 'Output matches the expected class or a value close to it'], ['Invalid input', 'Provide input in the wrong format', 'A clear error is shown, no crash'], ['Reproducibility', 'Re-run with the same random seed', 'Results are the same'], ['Interface', 'Submit data through the user interface', 'Prediction is displayed']],
    entities_note: '',
    future: ['Try additional algorithms and tune hyper-parameters.', 'Collect more and better-balanced data.', 'Deploy the model as a cloud API.', 'Add explainability (feature importance).', 'Continuous monitoring and retraining.'],
    limitations: ['Model accuracy depends on the quality and size of the dataset used.', 'The model may not generalise to data that differs from the training data.', 'Results should be treated as decision support, not as a replacement for expert judgement.'],
  } as Partial<Domain>),
  generic('iot', 'Internet of Things / embedded', {
    background: ['The Internet of Things links sensors and actuators to software so that physical conditions can be monitored and controlled remotely. Low-cost microcontrollers with Wi-Fi make it practical to build monitoring systems for homes, farms, laboratories and industry.'],
    problem: ['Physical parameters such as temperature, humidity, motion or energy use are often checked manually and infrequently, so problems are noticed late. Automated sensing with alerts and remote dashboards improves safety and efficiency.'],
    actors: ['Operator / user', 'Administrator'], modules: ['Sensor reading', 'Microcontroller firmware', 'Communication (Wi-Fi / MQTT / HTTP)', 'Data storage', 'Dashboard and visualisation', 'Alerts and control of actuators'],
    entities: ['Device', 'Sensor reading', 'Alert rule', 'User'],
    tests: [['Sensor', 'Read the sensor in a known condition', 'Reading is within the expected tolerance'], ['Connectivity', 'Power the device on', 'Device connects to the network/broker'], ['Data transmission', 'Send a reading', 'Reading appears on the dashboard with a timestamp'], ['Alert', 'Exceed the threshold', 'Alert is raised and logged'], ['Connection loss', 'Disconnect the network', 'Device retries and recovers without manual reset'], ['Actuator', 'Send a control command', 'Actuator changes state'], ['Power cycle', 'Restart the device', 'It resumes normal operation'], ['Dashboard', 'Open the dashboard', 'Latest values and history are shown']],
    future: ['Battery and power optimisation.', 'Over-the-air firmware updates.', 'Machine-learning-based anomaly detection.', 'Additional sensors and mobile notifications.', 'Secure device provisioning and encrypted communication.'],
    limitations: ['Readings depend on sensor accuracy and calibration.', 'Operation depends on network availability.', 'Hardware has been tested in laboratory conditions only.'],
  }),
  generic('blockchain', 'Blockchain / smart contracts', {
    background: ['Blockchain is a distributed ledger whose records are linked and secured with cryptography. Smart contracts are programs stored on the blockchain that enforce rules automatically, enabling applications such as certificate verification, supply-chain tracking and voting without a central authority.'],
    problem: ['Records kept in centralised databases can be altered or lost, and third parties must be trusted to verify them. A blockchain-based design makes records tamper-evident and publicly verifiable.'],
    actors: ['Issuer / administrator', 'User / verifier'], modules: ['Smart contract', 'Wallet connection', 'Front-end application', 'Transaction handling', 'Verification / query interface'],
    entities: ['Account / wallet address', 'Smart-contract state', 'Transaction', 'Record (e.g., certificate hash)'],
    tests: [['Deployment', 'Deploy the contract to a local or test network', 'Deployment succeeds and an address is returned'], ['Write function', 'Call the function that stores a record', 'Transaction is mined and the event is emitted'], ['Read function', 'Query a stored record', 'Correct data is returned'], ['Access control', 'Call a restricted function from a non-owner account', 'Transaction is reverted'], ['Invalid input', 'Submit malformed input', 'Contract rejects it with a clear revert reason'], ['Wallet', 'Connect the wallet in the interface', 'Account address is displayed'], ['Gas', 'Check gas used by main functions', 'Gas use is recorded and reasonable']],
    future: ['Deploy to a public test network and then to mainnet after an audit.', 'Add role-based permissions.', 'Use decentralised storage (IPFS) for large files.', 'Gas optimisation.', 'Mobile wallet integration.'],
    limitations: ['The contract has been tested on a local/test network only and has not been professionally audited.', 'Transactions cost gas and throughput is limited.'],
  }),
  generic('security', 'Cybersecurity tool / lab', {
    background: ['Cybersecurity protects systems, networks and data from unauthorised access and attacks. Security tools help administrators discover weaknesses, monitor activity and understand how attacks work so that defences can be improved.'],
    problem: ['Organisations often do not know which of their systems are exposed or vulnerable until an incident occurs. Tools that analyse and report on security posture help prevent this.'],
    actors: ['Security analyst', 'Administrator'], modules: ['Target / input configuration', 'Scanning or analysis engine', 'Result processing', 'Reporting', 'Logging'],
    entities: ['Target', 'Scan job', 'Finding', 'Report'],
    tests: [['Authorised target', 'Run the tool against a system you own or have written permission to test', 'Results are produced'], ['Invalid target', 'Provide a malformed address', 'Input is rejected with an error'], ['Timeout', 'Target does not respond', 'Tool times out gracefully'], ['Report', 'Generate a report', 'Findings are listed with severity'], ['Logging', 'Review the log', 'Actions are recorded with timestamps']],
    future: ['Integration with vulnerability databases.', 'Scheduled scans and alerting.', 'Web dashboard.', 'Remediation recommendations.'],
    limitations: ['The tool must only be used on systems the user owns or is explicitly authorised to test.', 'It may produce false positives or miss vulnerabilities.'],
  }),
  generic('devops', 'Cloud / DevOps automation', {
    background: ['DevOps combines development and operations practices to deliver software quickly and reliably. Automation of building, testing and deployment reduces manual errors, and containers and cloud services make environments reproducible and scalable.'],
    problem: ['Manual build and deployment steps are slow, inconsistent and error-prone, and problems are discovered late. Automated pipelines detect defects early and make releases repeatable.'],
    actors: ['Developer', 'Operations engineer'], modules: ['Source repository', 'Build and test automation', 'Container image creation', 'Deployment automation', 'Monitoring and logging'],
    entities: ['Pipeline', 'Build', 'Container image', 'Environment'],
    tests: [['Trigger', 'Push a commit', 'Pipeline starts automatically'], ['Build', 'Run the build stage', 'Artifacts / images are produced'], ['Test failure', 'Introduce a failing test', 'Pipeline stops and reports the failure'], ['Deployment', 'Run the deploy stage', 'Application is reachable in the target environment'], ['Rollback', 'Deploy a faulty version and roll back', 'Previous version is restored'], ['Secrets', 'Inspect logs', 'No secrets are printed']],
    future: ['Blue/green or canary deployments.', 'Infrastructure as code for all environments.', 'Centralised monitoring and alerting.', 'Cost optimisation.'],
    limitations: ['Pipeline behaviour depends on the availability of the CI/CD service and cloud account used.'],
  }),
  generic('desktop', 'Desktop application', {
    background: ['Desktop applications run directly on a computer and can work offline, use local files and peripherals, and offer responsive interfaces. They remain widely used for billing, inventory, payroll and utility software.'],
    problem: ['Small businesses and institutions need reliable software that works without constant internet access and keeps data on their own computers.'],
    actors: ['Operator', 'Administrator'], modules: ['Login', 'Main data-entry forms', 'Local database', 'Search', 'Report / print module', 'Backup and restore'],
    entities: ['User', 'Primary business record(s)', 'Transaction'],
    tests: [...mgmtTests.slice(0, 14), ['Installation', 'Install on a clean machine', 'Application installs and starts'], ['Backup', 'Create a backup and restore it', 'Data is restored correctly']],
  }),
];

const byKey = (k: string) => DOMAINS.find((d) => d.key === k)!;
const GENERIC = generic('management', 'Management information system', {});
/** Pick the closest domain profile from the app type and the project's own words. */
export function domainFor(p: ReportProject): Domain {
  const text = `${p.title} ${p.summary} ${p.technologies.join(' ')}`.toLowerCase();
  if (/(e-?commerce|shop|store|cart|ordering|food order)/.test(text)) return byKey('ecommerce');
  switch (p.appType) {
    case 'mobile': return byKey('mobile');
    case 'ai-ml': case 'data-science': return byKey('ml');
    case 'iot': return byKey('iot');
    case 'blockchain': return byKey('blockchain');
    case 'cybersecurity': return byKey('security');
    case 'cloud-devops': return byKey('devops');
    case 'desktop': return byKey('desktop');
  }
  return GENERIC;
}

// ───────────── Viva question bank (general, accurate) ─────────────
export const GENERAL_VIVA: [string, string][] = [
  ['What is the Software Development Life Cycle?', 'A structured process of planning, analysing, designing, implementing, testing, deploying and maintaining software.'],
  ['What is the difference between functional and non-functional requirements?', 'Functional requirements describe what the system does (features); non-functional requirements describe quality attributes such as performance, security and usability.'],
  ['What is a Data Flow Diagram?', 'A diagram that shows how data moves between external entities, processes and data stores in a system.'],
  ['What is an ER diagram?', 'A diagram that models entities, their attributes and the relationships between them; it is the basis for database design.'],
  ['What is the difference between a primary key and a foreign key?', 'A primary key uniquely identifies each row in a table; a foreign key is a column that refers to the primary key of another table to link records.'],
  ['What is normalisation and why is it used?', 'Organising tables to reduce redundancy and avoid update, insert and delete anomalies, typically up to third normal form.'],
  ['What is the difference between SQL and NoSQL databases?', 'SQL databases store data in related tables with a fixed schema and use SQL; NoSQL databases (document, key-value, graph, column) use flexible models and are often chosen for scalability and flexible data.'],
  ['What does CRUD stand for?', 'Create, Read, Update and Delete - the four basic operations on stored data.'],
  ['What is MVC?', 'Model-View-Controller, an architectural pattern separating data (model), presentation (view) and input handling (controller).'],
  ['What is REST?', 'An architectural style for web services using resource URLs and HTTP methods (GET, POST, PUT/PATCH, DELETE), usually exchanging JSON.'],
  ['What is the difference between authentication and authorisation?', 'Authentication verifies who the user is; authorisation decides what that user is allowed to do.'],
  ['How should passwords be stored?', 'As salted hashes produced by a slow algorithm such as bcrypt, scrypt or Argon2 - never in plain text and not with fast unsalted hashes.'],
  ['What is the difference between hashing and encryption?', 'Hashing is one-way and cannot be reversed; encryption is two-way and can be decrypted with a key.'],
  ['What is SQL injection and how is it prevented?', 'An attack in which malicious input alters a database query. It is prevented with parameterised queries or an ORM and input validation.'],
  ['What is XSS?', 'Cross-site scripting: injecting malicious script into pages viewed by other users. It is prevented by escaping output and sanitising input.'],
  ['What is the difference between a session and a JWT?', 'A session stores user state on the server and identifies it with a cookie; a JWT is a signed token carrying claims that the client sends with each request.'],
  ['What is middleware?', 'A function that sits between the request and the final handler to perform tasks such as logging, authentication or validation.'],
  ['What is an ORM?', 'Object-Relational Mapping: a library that maps database tables to programming-language objects so queries can be written in code.'],
  ['What is the difference between unit and integration testing?', 'Unit testing checks one component in isolation; integration testing checks that components work together.'],
  ['What is black-box testing?', 'Testing behaviour against the specification without knowledge of the internal code.'],
  ['What is boundary value analysis?', 'Testing values at and around the edges of valid input ranges, where errors are most likely.'],
  ['What is version control and why use Git?', 'Version control records the history of changes; Git is a distributed system that supports branching, merging and collaboration.'],
  ['What is responsive web design?', 'Designing pages that adapt their layout to different screen sizes using flexible grids and media queries.'],
  ['What is HTTPS?', 'HTTP over TLS, which encrypts data in transit and authenticates the server.'],
  ['What is an API?', 'An Application Programming Interface: a defined way for programs to communicate with each other.'],
  ['What are ACID properties?', 'Atomicity, Consistency, Isolation and Durability - guarantees of reliable database transactions.'],
  ['Name some project limitations and future enhancements.', 'Answer honestly from your own project: for example limited testing scale, missing notifications or analytics, and possible mobile or cloud versions.'],
];
export const GLOSSARY: [string, string][] = [
  ['API', 'Application Programming Interface'], ['CRUD', 'Create, Read, Update, Delete'], ['CSS', 'Cascading Style Sheets'], ['DFD', 'Data Flow Diagram'], ['DOM', 'Document Object Model'], ['ER', 'Entity-Relationship'], ['GUI', 'Graphical User Interface'],
  ['HTML', 'HyperText Markup Language'], ['HTTP/HTTPS', 'HyperText Transfer Protocol (Secure)'], ['IDE', 'Integrated Development Environment'], ['JSON', 'JavaScript Object Notation'], ['JWT', 'JSON Web Token'], ['MVC', 'Model-View-Controller'], ['ORM', 'Object-Relational Mapping'],
  ['REST', 'Representational State Transfer'], ['SDLC', 'Software Development Life Cycle'], ['SQL', 'Structured Query Language'], ['SRS', 'Software Requirements Specification'], ['UI/UX', 'User Interface / User Experience'], ['UML', 'Unified Modeling Language'], ['URL', 'Uniform Resource Locator'],
];
