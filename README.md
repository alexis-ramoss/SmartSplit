# SmartSplit Development Report

Welcome to the documentation of **SmartSplit**!

This Software Development Report, tailored for LEIC-ES-2025-26, provides comprehensive details about **SmartSplit**, starting from an high-level vision and going into low-level implementation decisions.

It is organised by the following activities:

* [Business modeling](#Business-Modelling) 
  * [Product Vision](#Product-Vision)
  * [Features and Assumptions](#Features-and-Assumptions)
* [Requirements](#Requirements)
  * [User stories](#User-stories)
  * [Domain model](#Domain-model)
  * [User interfaces](#User-interfaces)
* [Architecture and Design](#Architecture-And-Design)
  * [Logical architecture](#Logical-Architecture)
  * [Physical architecture](#Physical-Architecture)
  * [Functional prototype](#Functional-Prototype)
* [Project management](#Project-Management)
  * [Sprint 0](#Sprint-0)
  * [Sprint 1](#Sprint-1)
  * [Sprint 2](#Sprint-2)
  * [Sprint 3](#Sprint-3)
  * [Final Release](#Final-Release)


Contributions are expected to be made exclusively by the initial team, but we may open them to the community, after the course, in all areas and topics: requirements, technologies, development, experimentation, testing, etc.

Please contact us!

Thank you!

* **Aléxis Ramos** - up202404977@up.pt
* **Luís Kong** - up202409115@up.pt
* **Luís Guimarães** - up202403752@up.pt
* **Clara Correia** - up202404979@up.pt
* **Team Member Name** - email@example.com

---

## Business Modelling

Business modeling in software development involves defining the product's vision, understanding market needs, aligning features with user expectations, and setting the groundwork for strategic planning and execution.

### Product Vision

  Our target with this app is erasing any financial friction between people living in the same space and preserving friendships at the same time. We know that finances are one of the leading causes of tension among roommates, resentment can easily build over forgotten grocery runs, unequal utility bills, or even the awkwardness of constantly asking someone to pay you back.

  So we believe that tracking shared expenses all the way from a late-night pizza run to monthly Wi-Fi bills, for example, should be transparent, automated, and stress-free. Well organized expense tracking shouldn't need a degree in accounting or a complex, color-coded spreadsheet. That's where our application comes in, it acts as a neutral, automated financial mediator, so roommates can forget arguing over spreadsheets and loose receipts and only need to enter the app from time to time and check if the are owing money to any of their living partners.

### Features and Assumptions

* **Expense Creation and Recording:** Users can quickly add shared expenses such as groceries, rent, utilities, or household purchases. Each expense includes details such as the payer, amount, description, category, and which roommates participated in the expense.

* **Automated Expense Splitting:** Instantly divide shared expenses among roommates without manual calculations. The system automatically determines how much each person owes based on the selected split configuration.

* **Equal and Custom Splits:** Expenses can be divided equally among all roommates or using custom percentage distributions depending on the living arrangement.

* **Custom Percentage Configuration:** Users can define fixed percentage contributions for recurring expenses such as rent or utilities (e.g., one roommate pays a higher share for a larger bedroom).

* **Selective Expense Participation:** Users can select which roommates are involved in a particular expense, allowing accurate tracking when not everyone participates in the same purchase.

* **Recurring Expense Management:** Automatically log recurring expenses such as rent, internet, electricity, or streaming subscriptions on a weekly or monthly schedule.

* **Real-Time Balance Tracking:** The system continuously updates balances whenever expenses or payments are added, allowing roommates to instantly see who owes money and who should receive it.

* **Smart Debt Simplification ("Who Owes Who"):** An algorithm calculates the most efficient way to settle debts, minimizing the number of transactions needed between roommates.

* **Settlement Tracking:** Users can mark payments as completed when debts are settled outside the app (e.g., bank transfer, MBWay, PayPal, or cash).

* **Expense Editing and Corrections:** Users can modify or remove expenses if mistakes are made, with balances automatically recalculated to reflect the changes.

* **Expense History and Activity Log:** The application keeps a complete history of all recorded expenses, payments, and modifications, ensuring transparency between roommates.

* **Expense Categories:** Expenses can be categorized (e.g., groceries, rent, utilities, entertainment, household items) to help users better understand shared spending patterns.

* **Dashboard Overview:** A clear dashboard summarizes current balances, recent expenses, and outstanding debts so roommates can quickly understand the household’s financial situation.

* **Roommate Group Management:** Users can create or join a shared household group where all roommates participate and track expenses together.

* **User Accounts and Authentication:** Each roommate has a secure personal account to access their shared household group and manage expenses.

* **Notifications and Reminders:** The system can notify users when new expenses are added, when balances change, or when payments are pending.

* **Data Persistence and Synchronization:** All expenses and balances are securely stored and synchronized so every roommate sees the most up-to-date information.

* **Cross-Platform Accessibility:** The application is designed to run on modern smartphones, allowing roommates to manage expenses conveniently from their devices.

### Assumptions

* Household harmony: roommates agree on the predefined split percentages and recurring schedules established within a shared "House" group.
* Single Currency: all users within a specific group operate using the same currency.
* Basic Categorization: have a predefined set of categories or icons, for users to have a basic breakdown of where their money is going (e.g., Rent, Utilities, Groceries, Drinks).
* Honor System: Because the app doesn't verify bank balances, you assume users trust one another. Settling a debt relies entirely on one user tapping "Mark as Paid" and the other acknowledging that the money was actually received.
* Wi-fi access: users have access to wi-fi.

### Dependencies
* The application depends on the React Native framework for cross-platform mobile development.

---

## Requirements

### User Stories

* As a user, I want to create a new group so that I can manage expenses with specific people.
* As a user, I want to join a group using an invitation code so that I can participate in shared expenses.
* As a user, I want to leave a group so that I am no longer responsible for its expenses.
* As a group member, I want to add a new expense so that shared costs are recorded.
* As a group member, I want to specify who paid for an expense so that the system can calculate balances correctly.
* As a group member, I want to edit an expense so that I can correct mistakes.
* As a group member, I want to create a recurring expense so that regular payments (e.g., rent, utilities) are automatically recorded.
* As a group member, I want to define the recurrence frequency so that the system matches real payment cycles.
* As a group member, I want to see my current balance so that I know how much I owe or am owed.
* As a group member, I want to see a breakdown of who owes whom so that settlements are clear.
* As a group member, I want to receive a notification when a new expense is added so that I stay informed.
* As a group member, I want to see who created or modified an expense so that transparency is maintained.
* As a group member, I want to see a timestamp for each expense so that records are traceable.
* As a group member, I want to choose who participates in an expense so that only people involved share the costs.


### Domain model

The SmartSplit domain focuses on the relationship between **Users**, **Groups**, and **Expenses**. A `Group` consists of multiple `Users`. An `Expense` is created within a `Group`, paid by one `User`, and split among several `Participants` (Users) according to a `SplitLogic`.

* **User:** Represents an individual with an account.
* **Group:** A shared household entity containing members.
* **Expense:** A financial record containing amount, date, and category.
* **Split:** The logic defining how an expense is distributed (Equal, Percentage).

---

## Architecture and Design

### Logical architecture

### Physical architecture

### Functional prototype

---

## Project management

### Sprint 0

### Sprint 1
### Sprint 2
### Sprint 3

### Final Release

---
