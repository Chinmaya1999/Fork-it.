// General software-engineering background. Accurate, project-independent textbook material.
import { type Block, p, h2, h3, bullets, numbered, table, note } from './types.js';

export const sdlcSection = (): Block[] => [
  h2('Software Development Life Cycle'),
  p('The Software Development Life Cycle (SDLC) is a structured process that describes the stages through which a software product is planned, built, tested, delivered and maintained. Following a life-cycle model makes development predictable, allows progress to be measured and reduces the risk of building the wrong product.'),
  p('The classic phases are requirement analysis, system design, implementation (coding), testing, deployment and maintenance. Each phase produces deliverables that feed the next: the requirement analysis produces a Software Requirements Specification (SRS); design produces architecture and database diagrams; implementation produces source code; testing produces test reports; and deployment places the system in the hands of its users.'),
  table(['Phase', 'Main activities', 'Typical deliverables'], [
    ['Requirement analysis', 'Interviews, observation, study of the existing system, feasibility study', 'SRS document, feasibility report'],
    ['System design', 'Architecture, database design, interface design, module breakdown', 'DFDs, ER diagram, UML diagrams, wireframes'],
    ['Implementation', 'Writing and reviewing code, integrating modules', 'Source code, build scripts'],
    ['Testing', 'Unit, integration, system and acceptance testing', 'Test plan, test cases, defect log'],
    ['Deployment', 'Installing, configuring and releasing the system', 'Installation guide, user manual'],
    ['Maintenance', 'Fixing defects, adding enhancements, adapting to change', 'Patches, new versions, change log'],
  ], [22, 45, 33], 'Table: Phases of the software development life cycle'),
  h3('Common process models'),
  bullets(
    'Waterfall model - phases are completed one after another in a fixed sequence. It is simple and well documented but inflexible when requirements change late.',
    'Incremental model - the system is built and delivered in small, working increments, each adding functionality, so users see value early.',
    'Spiral model - combines iterative development with explicit risk analysis in every loop; suited to large, high-risk projects.',
    'Agile methods (Scrum, Kanban, Extreme Programming) - short iterations called sprints, continuous feedback from users, working software over comprehensive documentation and adaptation to change.',
    'Prototyping model - a quick, partial version is built so that users can react to it before the final system is developed.'),
];

export const feasibilitySection = (techLine: string): Block[] => [
  h2('Feasibility Study'),
  p('A feasibility study evaluates whether a proposed system is worth building before significant effort is spent. It examines the project from several complementary viewpoints.'),
  h3('Technical feasibility'),
  p(`Technical feasibility asks whether the required technology exists and whether the team has the skills and tools to use it. The project uses ${techLine}. These technologies are mature, well documented and supported by large communities, and they run on ordinary student hardware, so the technical risk is considered low.`),
  h3('Economic feasibility'),
  p('Economic feasibility compares the expected costs with the expected benefits. Development of an academic project uses free or open-source software and existing hardware, so direct costs are minimal. The benefits include automation of manual work, faster retrieval of information, fewer errors and better decision making. Because costs are small and benefits are tangible, the system is economically feasible.'),
  h3('Operational feasibility'),
  p('Operational feasibility examines whether the intended users will accept and be able to operate the system. A clear, consistent interface, input validation with helpful messages and role-based access make the system easy to learn. Training needs are modest because users interact through familiar forms, tables and buttons.'),
  h3('Schedule feasibility'),
  p('Schedule feasibility checks that the work can be completed in the time available. The project is divided into analysis, design, implementation, testing and documentation tasks with milestones that fit within the academic calendar.'),
];

export const requirementsTheory = (): Block[] => [
  h2('Requirements Engineering'),
  p('Requirements engineering is the process of discovering, documenting and maintaining what a system must do and the constraints under which it must operate. A requirement is a statement that can be verified - for example, "the system shall allow a registered user to reset a forgotten password by e-mail" - rather than a vague wish such as "the system should be user friendly".'),
  h3('Requirement elicitation techniques'),
  bullets('Interviews with the people who will use the system', 'Questionnaires and surveys when many users are involved', 'Observation of the current manual or software process', 'Document analysis of forms, registers and reports currently in use', 'Prototyping - showing mock screens and collecting feedback'),
  h3('Functional and non-functional requirements'),
  p('Functional requirements describe the behaviours and services the system provides, such as user registration, searching, report generation or payment processing. Non-functional requirements describe quality attributes and constraints: performance, security, reliability, usability, portability, maintainability and compatibility.'),
  table(['Quality attribute', 'Meaning', 'Example of a measurable statement'], [
    ['Performance', 'Speed and resource use', 'A search returns results in under 2 seconds for 10,000 records'],
    ['Security', 'Protection of data and access', 'Passwords are stored only as salted hashes; sessions expire after inactivity'],
    ['Reliability', 'Ability to operate without failure', 'The system recovers from a server restart without losing committed data'],
    ['Usability', 'Ease of learning and use', 'A new user can complete registration without external help'],
    ['Portability', 'Ability to run on different platforms', 'Runs on Windows, Linux and macOS'],
    ['Maintainability', 'Ease of changing the system', 'Code is organised in modules with a documented structure'],
  ], [20, 30, 50], 'Table: Non-functional requirements'),
];

export const designTheory = (): Block[] => [
  h2('Architectural Styles'),
  p('Software architecture describes the major components of a system and how they interact. Choosing an appropriate architecture makes the system easier to understand, test and extend.'),
  h3('Client-server architecture'),
  p('In the client-server model, a client (a browser or mobile app) sends requests over a network and a server processes them and returns responses. The server centralises data and business rules, and many clients can share it at the same time.'),
  h3('Three-tier architecture'),
  p('A three-tier application separates the presentation tier (user interface), the application tier (business logic) and the data tier (database). Each tier can be developed, scaled and replaced independently, which improves maintainability and security.'),
  h3('Model-View-Controller (MVC)'),
  p('MVC divides application code into three roles. The model represents data and business rules, the view presents information to the user, and the controller receives user input, updates the model and selects the view. This separation of concerns lets developers change the interface without rewriting the data layer and makes automated testing easier.'),
  h2('Data Flow Diagrams'),
  p('A Data Flow Diagram (DFD) shows how data moves through a system: which external entities send or receive data, which processes transform it and which data stores hold it. DFDs are drawn at increasing levels of detail.'),
  bullets('Level 0 (context diagram) - the whole system as a single process with its external entities.', 'Level 1 - the main processes of the system and the data stores they use.', 'Level 2 - decomposition of individual Level-1 processes into finer steps.'),
  table(['Symbol', 'Meaning'], [['Rectangle', 'External entity (source or destination of data)'], ['Circle / rounded rectangle', 'Process that transforms data'], ['Open-ended rectangle / two parallel lines', 'Data store'], ['Arrow', 'Data flow, labelled with the data that moves']], [35, 65], 'Table: DFD notation (Yourdon/DeMarco style)'),
  h2('Entity-Relationship Modelling'),
  p('An Entity-Relationship (ER) diagram models the data of a system. Entities are things about which data is stored (for example a user or an order); attributes describe them; and relationships connect entities with a cardinality of one-to-one, one-to-many or many-to-many. A many-to-many relationship is implemented with a separate linking table that holds the keys of both entities.'),
  h3('Normalisation'),
  p('Normalisation organises tables to reduce redundancy and update anomalies. First Normal Form (1NF) requires atomic values and no repeating groups. Second Normal Form (2NF) additionally removes attributes that depend on only part of a composite key. Third Normal Form (3NF) removes attributes that depend on other non-key attributes. Most transactional databases are designed to at least 3NF; document databases such as MongoDB sometimes deliberately embed related data for read performance.'),
  h2('Unified Modeling Language (UML)'),
  p('UML is a standard visual notation for modelling software. The diagrams most often included in project reports are listed below.'),
  table(['Diagram', 'Purpose'], [
    ['Use-case diagram', 'Shows the actors and the functions of the system they can use'],
    ['Class diagram', 'Shows classes, their attributes, methods and relationships'],
    ['Sequence diagram', 'Shows the order of messages between objects for one scenario'],
    ['Activity diagram', 'Shows the flow of a workflow or algorithm, including decisions'],
    ['State diagram', 'Shows the states an object can be in and the events that change them'],
    ['Deployment diagram', 'Shows how software components are placed on hardware nodes'],
  ], [30, 70], 'Table: Commonly used UML diagrams'),
];

export const securityTheory = (): Block[] => [
  h2('Security Considerations'),
  p('Security must be considered from the start of a project, not added at the end. The Open Web Application Security Project (OWASP) maintains a list of the most critical web-application risks, and the following measures address the most common ones.'),
  bullets(
    'Authentication - verify identity with a username and password; store passwords only as salted, slow hashes (such as bcrypt, scrypt or Argon2), never in plain text.',
    'Authorisation - check on the server that the logged-in user is allowed to perform every action and see every record (role-based access control).',
    'Input validation - validate type, length and format of all input on the server; do not rely only on browser-side checks.',
    'SQL / NoSQL injection - use parameterised queries or an ORM instead of building queries by concatenating user input.',
    'Cross-site scripting (XSS) - escape or sanitise user-supplied content before displaying it.',
    'Cross-site request forgery (CSRF) - protect state-changing requests with anti-forgery tokens or same-site cookies.',
    'Transport security - serve the application over HTTPS so that data in transit is encrypted.',
    'Secrets management - keep keys and passwords in environment variables, not in source code or public repositories.',
    'Session management - use HTTP-only, secure cookies or short-lived tokens, and invalidate sessions on logout.'),
];

export const testingTheory = (): Block[] => [
  h2('Software Testing Concepts'),
  p('Testing is the process of executing a program to find defects and to confirm that it meets its requirements. Testing cannot prove that a program has no bugs, but systematic testing greatly increases confidence in its quality.'),
  table(['Level', 'Scope', 'Performed by'], [
    ['Unit testing', 'A single function, class or module in isolation', 'Developer'],
    ['Integration testing', 'Interaction between modules, services or the database', 'Developer / tester'],
    ['System testing', 'The complete, integrated system against the requirements', 'Tester'],
    ['Acceptance testing', 'Whether the system satisfies user needs in realistic use', 'End user / client'],
    ['Regression testing', 'Re-running tests after a change to detect new defects', 'Tester (often automated)'],
  ], [25, 50, 25], 'Table: Levels of testing'),
  h3('Black-box and white-box testing'),
  p('Black-box testing treats the program as a box with inputs and outputs and checks behaviour against the specification without looking at the code. White-box testing uses knowledge of the code structure to design tests that exercise statements, branches and paths.'),
  h3('Test-design techniques'),
  bullets('Equivalence partitioning - divide inputs into classes that should behave the same and test one value from each class.', 'Boundary value analysis - test values at and just beyond the edges of valid ranges, where defects are most likely.', 'Error guessing - use experience to test situations that commonly cause failures, such as empty input or duplicate records.'),
  p('A good test case states a unique identifier, the feature under test, the preconditions, the input data, the steps, the expected result, the actual result and whether it passed or failed.'),
];

export const deploymentTheory = (): Block[] => [
  h2('Deployment and Version Control'),
  p('Deployment is the process of making the software available to users. A web application is typically installed on a server or cloud platform, configured with environment variables, connected to a production database and served over HTTPS. Desktop and mobile applications are packaged as installers or store bundles.'),
  p('Source code should be kept under version control with Git. Each logical change is saved as a commit with a descriptive message; branches isolate work in progress; and a remote repository on GitHub or GitLab acts as a backup and a collaboration point. A repository should include a README that explains how to install and run the project, a .gitignore file that excludes dependencies and secrets, and a license file that states how others may reuse the code.'),
];

// ───────────── optional appendix pool: added (in order) only when more pages are needed to reach the minimum ─────────────
export const extraChapters = (): { title: string; blocks: Block[] }[] => [
  { title: 'Project Management and Estimation', blocks: [
    p('Project management applies planning, scheduling and control to deliver a project within scope, time and budget. A work-breakdown structure divides the project into tasks; a Gantt chart shows when each task starts and ends; and a critical-path analysis identifies the tasks that determine the minimum project duration.'),
    p('Effort can be estimated by comparing with similar past projects, by counting function points, or with parametric models such as COCOMO (Constructive Cost Model), which relates effort to the estimated size of the code in thousands of lines (KLOC). The basic COCOMO equation for an organic project is Effort = 2.4 x (KLOC)^1.05 person-months.'),
    table(['Task', 'Duration (weeks)', 'Depends on'], [['Requirement gathering', '2', '-'], ['System design', '3', 'Requirement gathering'], ['Implementation', '6', 'System design'], ['Testing', '3', 'Implementation'], ['Documentation and report', '2', 'Testing']], [45, 25, 30], 'Table: Example project schedule (adapt to your own timeline)'),
  ] },
  { title: 'Risk Management', blocks: [
    p('Risk management identifies events that could harm the project, estimates their likelihood and impact, and plans how to reduce them. Typical risks in student projects include unclear requirements, underestimated effort, data loss, unfamiliar technology and dependency on third-party services.'),
    table(['Risk', 'Likelihood', 'Impact', 'Mitigation'], [['Requirements change late', 'Medium', 'High', 'Confirm requirements early; use incremental delivery'], ['Data loss', 'Low', 'High', 'Regular backups and version control'], ['Unfamiliar technology', 'Medium', 'Medium', 'Build small prototypes before the main implementation'], ['Third-party API unavailable', 'Low', 'Medium', 'Handle errors gracefully; keep local fallbacks']], [25, 15, 15, 45], 'Table: Sample risk register'),
  ] },
  { title: 'User Interface and Usability Principles', blocks: [
    p('A good interface lets users accomplish their goals efficiently and without confusion. Widely accepted heuristics include visibility of system status, a match between the system and the real world, user control and freedom, consistency and standards, error prevention, recognition rather than recall, flexibility and efficiency of use, minimalist design, helpful error messages and accessible help.'),
    bullets('Use consistent layout, colours and terminology across screens.', 'Provide immediate feedback for every action (loading indicators, success and error messages).', 'Make forms short, label every field and validate input as early as possible.', 'Ensure sufficient colour contrast and keyboard accessibility for users with disabilities.', 'Design responsive layouts that work on phones, tablets and desktops.'),
  ] },
  { title: 'API Design Principles', blocks: [
    p('Well-designed application programming interfaces are predictable and easy to consume. Resources are named with nouns (for example /students and /students/42) and manipulated with HTTP methods. Responses use appropriate status codes - 200 for success, 201 for creation, 400 for invalid input, 401 and 403 for authentication and authorisation failures, 404 when a resource does not exist and 500 for server errors.'),
    bullets('Version the API (for example /api/v1) so that changes do not break existing clients.', 'Support pagination, filtering and sorting for collections.', 'Return consistent error objects with a code and a human-readable message.', 'Document every endpoint with its inputs, outputs and example requests.'),
  ] },
  { title: 'Cloud Computing Basics', blocks: [
    p('Cloud computing delivers computing resources - servers, storage, databases and networking - over the internet on a pay-for-use basis. Service models include Infrastructure as a Service (virtual machines), Platform as a Service (managed runtimes) and Software as a Service (complete applications). Deployment models include public, private and hybrid clouds.'),
    p('Benefits include elasticity, no up-front hardware cost and global availability. Considerations include cost control, data protection, vendor lock-in and the shared-responsibility model, in which the provider secures the infrastructure while the customer secures its own data, accounts and configuration.'),
  ] },
  { title: 'Software Quality, Maintenance and Documentation', blocks: [
    p('Software quality is the degree to which a product meets requirements and user expectations. Quality is built in through code reviews, coding standards, automated tests, static analysis and continuous integration. Maintenance accounts for a large share of the total cost of software and is classified as corrective (fixing defects), adaptive (adjusting to a new environment), perfective (improving features or performance) and preventive (restructuring to avoid future problems).'),
    p('Documentation supports maintenance: the README explains setup, inline comments explain non-obvious decisions, API documentation describes interfaces, and the user manual explains how to use the system. Keeping documentation next to the code and updating it with every change prevents it from becoming obsolete.'),
  ] },
  { title: 'Ethics, Licensing and Academic Integrity', blocks: [
    p('Software engineers have professional responsibilities to users, employers and society. Respecting the licence of open-source code is a legal and ethical obligation: permissive licences (MIT, BSD, Apache 2.0) allow reuse with attribution; copyleft licences (GPL, AGPL) require derived works to be released under the same terms; and code with no licence is not free to copy or redistribute.'),
    p('Academic work must acknowledge the sources it builds on. If a project is based on or adapted from existing software, the report should say so clearly, identify the original author and licence, and explain precisely which parts the student studied, modified or implemented personally. Presenting someone else\'s work as one\'s own is plagiarism and can lead to disciplinary action by the institution.'),
  ] },
  { title: 'Database Administration Basics', blocks: [
    p('A database must be designed, secured and maintained. Indexes speed up searches on frequently queried columns at the cost of slower writes and extra storage. Transactions group several operations so that they either all succeed or all fail, preserving consistency (ACID: atomicity, consistency, isolation, durability).'),
    bullets('Take regular backups and test that they can be restored.', 'Grant each application account only the privileges it needs.', 'Use migrations so that schema changes are versioned and repeatable.', 'Monitor slow queries and add indexes where they help.'),
  ] },
];
