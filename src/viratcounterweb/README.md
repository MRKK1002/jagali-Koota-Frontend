# Virat Counter Web App

A web-based version of the Virat Counter mobile app, integrated into the Hotel Virat Admin Panel.

## Features

- **Counter Login**: OTP-based authentication for counter staff
- **Branch Selection**: Choose branch location for orders
- **Customer Details**: Capture customer information
- **Menu Management**: Browse and search menu items by category
- **Cart Management**: Add/remove items with quantity controls
- **Bill Generation**: Generate detailed bills with tax calculations
- **Payment Processing**: Support for Cash, Card, and UPI payments
- **Order History**: View recent orders and transactions
- **Receipt Printing**: Print customer receipts

## Access

The counter web app is accessible at `/counter` route within the admin panel:

```
https://your-domain.com/counter
```

## File Structure

```
viratcounterweb/
├── CounterApp.jsx          # Main counter app component
├── CounterApp.css          # Counter-specific styles
├── services/
│   └── counterApi.js       # API service for counter operations
├── pages/
│   ├── CounterLogin.jsx    # Login with OTP
│   ├── BranchSelection.jsx # Branch selection
│   ├── CustomerDetails.jsx # Customer information form
│   ├── MenuScreen.jsx      # Menu browsing and cart
│   ├── BillGeneration.jsx  # Bill summary and review
│   ├── PaymentScreen.jsx   # Payment processing
│   ├── PaymentSuccess.jsx  # Payment confirmation
│   └── OrderList.jsx       # Order history
└── README.md              # This file
```

## Usage Flow

1. **Login**: Counter staff login with mobile number and OTP
2. **Branch Selection**: Select the branch location
3. **Customer Details**: Enter customer name and phone number
4. **Menu Selection**: Browse menu, add items to cart
5. **Bill Generation**: Review order summary and totals
6. **Payment**: Process payment (Cash/Card/UPI)
7. **Success**: Print receipt and start new order

## API Integration

The app integrates with the existing Hotel Virat backend APIs:

- Counter authentication endpoints
- Branch management
- Menu and category data
- Order processing
- Bill generation
- Payment processing

## Responsive Design

The web app is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile devices

## Print Support

Built-in print functionality for:
- Customer receipts
- Order summaries
- Bill details

## Auto-redirect

After successful payment, the app automatically redirects to start a new order after 10 seconds for improved workflow efficiency.