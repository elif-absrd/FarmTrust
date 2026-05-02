# FarmTrust 🌾

A blockchain-based automated insurance and plant disease detection system that empowers Indian farmers with AI-driven diagnostics and transparent, automated insurance payouts.

link to the log worksheet: https://1drv.ms/x/c/19fc1823325ea3bf/IQBXSRXngwzGT5OGHn3HFwE5AY0cC3L4Fji_u_ew2f1PWmE?e=s2m9eu 

## Table of Contents

- [Abstract](#abstract)
- [Objectives](#objectives)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Methodology](#methodology)
- [System Architecture](#system-architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
- [Future Enhancements](#future-enhancements)

## Abstract

In India's vast agricultural landscape, millions of smallholder farmers face crop losses from diseases. Traditional insurance methods often fail because of delays, fraud, and complicated processes. This project presents a new system that uses deep learning for real-time plant disease detection and blockchain for automated, clear insurance payouts.

We build on a lightweight Convolutional Neural Network (CNN) model initially created for binary disease classification, which achieved 94.59% validation accuracy on the New Plant Diseases Dataset. We extend this model to multi-class detection and integrate it with a mobile app and blockchain backend. For ethical demonstrations, we use mock blockchain accounts to simulate quick payouts without depending on real government funds.

This approach aims to empower Indian farmers by offering accessible tools for early disease intervention and financial security. It aligns with national programs like Pradhan Mantri Fasal Bima Yojana (PMFBY) to improve rural resilience and food security.

## Objectives

- **Develop Enhanced Deep Learning Model**: Create an improved deep learning model for real-time multi-class plant disease detection for major Indian crops
- **User-Friendly Mobile Application**: Build a mobile app that allows farmers to scan leaves and get instant diagnoses and recommendations
- **Blockchain Integration**: Use blockchain for secure and transparent storage of diagnostic data and automated insurance triggers
- **Simulated Insurance Payouts**: Demonstrate insurance payouts with mock blockchain accounts, showing efficiency without using real funds
- **Cost-Effective Solutions**: Include free options for cloud storage and testing to ensure access for developers and users with limited resources
- **Performance Testing**: Test the system's performance in simulated Indian agricultural situations, focusing on accuracy, speed, and usability

## Key Features

### Real-Time Multi-Class Disease Detection

- **High Accuracy**: Identifies diseases in important Indian crops (rice blast, wheat rust, tomato leaf curl)
- **On-Device Processing**: Lightweight model (MobileNetV3/MobileViT) runs efficiently on mobile devices
- **Severity Estimation**: Assesses disease severity to determine insurance claim eligibility

### User-Friendly Mobile Interface

- **Simple Camera-Based Scanning**: Point and shoot to diagnose plant diseases
- **Instant Diagnosis**: Real-time results with disease identification and recommendations
- **Offline First**: Accessible for rural farmers with limited connectivity

### Automated Parametric Insurance Triggers

- **Smart Contract Automation**: AI results automatically trigger insurance payouts based on predefined thresholds
- **Transparent Process**: Blockchain ensures all transactions are traceable and fraud-proof
- **Quick Payouts**: Eliminates delays associated with traditional insurance claims
- **PMFBY Integration**: Aligns with Pradhan Mantri Fasal Bima Yojana requirements

### Mock Blockchain Testing

- **Polygon Testnet**: Free testnet deployment for development and demonstration
- **Multi-Wallet Simulation**: Simulate farmer, insurer, and government wallets
- **ERC-20 Mock Tokens**: "MockINR" tokens demonstrate payout mechanisms without real funds
- **Safe Testing**: No real money involved in development and testing phases

### Free Storage and Tools

- **IPFS Integration**: Decentralized, cost-free image and document storage
- **Firebase Free Tier**: Push notifications and basic data storage
- **Ganache Local Testing**: Local blockchain simulation for rapid development
- **Open Source Stack**: All tools are free and accessible

### Traceability and Analytics

- **Immutable On-Chain Logs**: Complete policy and claim history stored on blockchain
- **Farmer Dashboard**: Track claims, view disease trends, and monitor policy status
- **Data Analytics**: Insights into disease patterns and claim statistics
- **Audit Trail**: Complete transparency for all stakeholders

## Technology Stack

### Mobile Application

- **Framework**: React Native for cross-platform iOS and Android development
- **UI Components**: React Native Paper for Material Design
- **Camera Integration**: React Native Camera for image capture
- **Offline Support**: AsyncStorage for local data persistence

### AI/ML Model

- **Framework**: TensorFlow 2.x and Keras for model development
- **Model Architecture**: MobileNetV3 / MobileViT for lightweight inference
- **Mobile Deployment**: TensorFlow Lite for on-device processing
- **Training**: Transfer learning on New Plant Diseases Dataset
- **Data Augmentation**: Rotation, brightness adjustment for Indian field conditions

### Backend

- **Server**: Node.js with Express.js
- **API**: RESTful API architecture
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: PostgreSQL for off-chain data (user profiles, policies)

### Blockchain

- **Network**: Polygon Testnet
- **Smart Contracts**: Solidity for automated insurance triggers
- **Development Framework**: Hardhat for contract deployment and testing
- **Web3 Integration**: Ethers.js for blockchain interaction
- **Oracle Simulation**: Chainlink testnet oracles for AI data feeds
- **Mock Tokens**: ERC-20 "MockINR" tokens for payout simulation
- **Local Testing**: Ganache for rapid development

### Storage

- **Decentralized Storage**: IPFS (InterPlanetary File System) for images and documents
- **Cloud Services**: Firebase free tier for notifications and basic storage
- **On-Chain Storage**: Blockchain for data hashes and policy records

### DevOps & Tools

- **Version Control**: Git & GitHub
- **Testing**: Jest for JavaScript, Truffle for smart contracts
- **API Documentation**: Swagger/OpenAPI
- **Continuous Integration**: GitHub Actions

## Methodology

Our methodology follows a clear process: data improvement, AI model training, mobile integration, blockchain simulation, and end-to-end testing.

### 1. Data Preparation and Enhancement

We start by enhancing the Kaggle New Plant Diseases Dataset with additional images relevant to Indian crops. We use data augmentation techniques like rotation, brightness adjustments, and flipping to imitate real field conditions and improve model robustness.

### 2. AI Model Development

For disease detection, we use transfer learning on lightweight models such as MobileNetV3 or MobileViT through TensorFlow and Keras. The trained model is then converted to TensorFlow Lite for efficient on-device inference, enabling offline functionality on farmer's mobile devices.

**Key Steps:**

- Binary classification (healthy vs diseased) as baseline

- Extension to multi-class detection for specific diseases
- Model optimization for mobile deployment
- Achieved 94.59% validation accuracy

### 3. Mobile Application Development

The mobile app is created with React Native for cross-platform compatibility. It captures images using the device camera and processes them offline using the TensorFlow Lite model. Data syncs to the backend when an internet connection is available.

**Features:**

- Camera integration for leaf scanning
- Offline disease detection
- Background sync when online
- User-friendly interface for rural farmers

### 4. Blockchain Integration

Blockchain integration utilizes Polygon Mumbai Testnet for smart contracts written in Solidity and deployed via Hardhat. We address the oracle problem by simulating data feeds with Chainlink testnet oracles, which relay AI results for claim verification.

**Architecture:**

- Smart contracts for insurance policy management
- Automated triggers based on disease severity thresholds
- ERC-20 "MockINR" tokens for simulated payouts
- On-chain storage of policy hashes for security
- Off-chain PostgreSQL for user profiles and detailed policy data

### 5. Free and Cost-Effective Solutions

To ensure accessibility and reduce costs:

1. **IPFS (InterPlanetary File System)**: Free peer-to-peer protocol for decentralized storage instead of paid cloud services like AWS S3
2. **Firebase Free Tier**: For app notifications and basic storage
3. **Ganache**: Local blockchain testing before moving to testnet deployment
4. **Polygon Mumbai Testnet**: Free testnet for blockchain development

### 6. Mock Insurance Payout Simulation

We simulate payouts using ERC-20 tokens ("MockINR") in test wallets. The system mimics conversions to INR through console logs that act like UPI/DBT transactions, demonstrating the payout mechanism without using real funds.

**Process Flow:**

1. Disease detection triggers severity assessment
2. If severity exceeds threshold, smart contract is notified
3. Oracle verifies AI results on-chain
4. Smart contract automatically releases mock tokens to farmer's wallet
5. System logs simulate conversion to real currency (INR)

## System Architecture

![FarmTrust System Architecture - Development Workflows](System%20Architecture.png)

The system architecture consists of four main development workflows:

1. **ML Model Preparation Pipeline**: Data preparation → Model selection → Training → Optimization → TensorFlow Lite conversion → Mobile deployment
2. **Mobile Development (React Native)**: App setup → UI design → Camera integration → TensorFlow Lite integration → Backend synchronization
3. **Blockchain Implementation**: Environment setup → Smart contracts → ERC-20 token creation → Oracle integration → IPFS storage
4. **Mock Payout Process**: Disease detection → Severity assessment → Oracle verification → Smart contract execution → Mock token transfer → Confirmation

### Data Flow

1. **Farmer Registration**: Farmers register on the platform with verified credentials and create blockchain wallet
2. **Insurance Policy Creation**: Farmers select crops and coverage, policy details stored off-chain (PostgreSQL) with hash on-chain
3. **Disease Detection**: Farmer captures leaf image via mobile app, TensorFlow Lite model processes image offline
4. **Diagnosis and Assessment**: App displays disease identification and severity level
5. **Claim Trigger**: If severity exceeds threshold, claim is automatically initiated
6. **Oracle Verification**: Chainlink oracle relays AI diagnosis to blockchain for verification
7. **Smart Contract Execution**: Contract validates claim and triggers payout if conditions are met
8. **Payout**: Mock ERC-20 tokens transferred to farmer's wallet, simulating INR conversion
9. **Record Keeping**: Complete audit trail maintained on blockchain for transparency

## Installation and Setup

### Prerequisites

- **Node.js** (v18+)
- **npm** or **yarn** or **pnpm**
- **PostgreSQL** (Local or Docker)
- **Python 3.8+** (for NDVI Service & ML model training)
- **Expo CLI** (for mobile app)
- **MetaMask** wallet extension (for blockchain interaction)

---

### 1. PostgreSQL Database Setup

**Windows:**
1. Download & Install [PostgreSQL](https://www.postgresql.org/download/windows/).
2. Open Command Prompt:
   ```bash
   psql -U postgres
   CREATE DATABASE farmtrust;
   \q
   ```

**Alternative using Docker:**
```bash
docker run --name farmtrust-db -e POSTGRES_PASSWORD=postgres -d -p 5432:5432 postgres
```

---

### 2. Backend Setup (Node.js)

The backend handles user authentication, farm management, and claim submission.

```bash
cd backend

# 1. Setup environment variables
cp .env.example .env
# Edit .env and update DB_PASSWORD or DATABASE_URL with your PostgreSQL credentials

# 2. Install dependencies
npm install

# 3. Apply database migrations & generate Prisma client
npx prisma generate
npx prisma db push

# 4. Start the backend server (runs on port 5000)
npm run dev
```

---

### 3. NDVI Service Setup (Python)

The NDVI service handles Google Earth Engine integration for satellite-based crop health verification.

```bash
cd ndvi-service

# 1. Setup environment variables
cp .env.example .env
# Ensure DB credentials match the backend

# 2. Create and activate a virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
# source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Start the FastAPI service (runs on port 8000)
# First run will open a browser to authenticate with Google Earth Engine
python main.py
```
*(Optional)* In a separate terminal, run `python cron_baseline.py` to start the background job that collects baseline NDVI metrics every 5 days.

---

### 4. Smart Contracts Setup (Web3)

Deploys the mock insurance smart contracts to a local hardhat network or testnet.

```bash
cd web3/web3

# 1. Install dependencies
npm install  # or pnpm install

# 2. Run a local Hardhat node (Keep this terminal open)
npx hardhat node

# 3. In a new terminal (still inside web3/web3), deploy the contracts:
npx hardhat ignition deploy ignition/modules/Counter.ts --network localhost
```

---

### 5. Mobile App Setup (Expo React Native)

The mobile app provides the interface for farmers to scan leaves and manage policies.

```bash
cd app

# 1. Install dependencies
npm install

# 2. Start the Expo development server (runs on port 8081)
npx expo start
```
*Note: To connect the app to your local backend on a physical device, ensure you update the backend API URL in the app's configuration to your machine's local IP address (e.g., `http://192.168.1.X:5000`) instead of `localhost`.*

---

## Usage

### Running the Entire Project Locally

To run the complete system, you will need multiple terminal windows open:

1. **Terminal 1 (Backend):** `cd backend && npm run dev`
2. **Terminal 2 (NDVI API):** `cd ndvi-service && venv\Scripts\activate && python main.py`
3. **Terminal 3 (NDVI Cron):** `cd ndvi-service && venv\Scripts\activate && python cron_baseline.py`
4. **Terminal 4 (Web3 Node):** `cd web3/web3 && npx hardhat node`
5. **Terminal 5 (Mobile App):** `cd app && npx expo start`

### Testing the Workflows

1. **Register and Onboard:**
   - Open the Expo app (on simulator or scan QR code via Expo Go).
   - Create an account with farmer credentials.
   - Set up your farm by defining the GPS polygon.

2. **Disease Detection:**
   - Use the "Scan Plant" feature in the app.
   - Capture a clear image of an affected leaf. The on-device ML model will identify the disease and severity.

3. **Automated Insurance Claims:**
   - If the severity is high (>0.6), a claim is automatically submitted to the backend.
   - The backend triggers the NDVI service to verify crop health via satellite.
   - If verified, the smart contract is executed, and mock ERC-20 tokens are transferred to the farmer's wallet.

## Contributing

We welcome contributions to FarmTrust! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/DiseaseDetectionImprovement`)
3. Commit your changes (`git commit -m 'Add improved disease detection for rice crops'`)
4. Push to the branch (`git push origin feature/DiseaseDetectionImprovement`)
5. Open a Pull Request

### Areas for Contribution

- **ML Model Improvements**: Enhance disease detection accuracy for specific crops
- **Mobile UI/UX**: Improve app interface for better farmer experience
- **Smart Contract Optimization**: Reduce gas costs and improve efficiency
- **Documentation**: Add translations, tutorials, and guides
- **Testing**: Write unit tests, integration tests, and end-to-end tests

Please ensure your code follows our coding standards and includes appropriate tests.

## License

GNU GENERAL PUBLIC LICENSE [LICENSE](LICENSE).

## Future Enhancements

### AI and Detection

- **Expanded Crop Coverage**: Include more crop varieties and diseases
- **Pest Detection**: Extend model to identify common agricultural pests
- **Soil Analysis**: Integrate soil health assessment capabilities
- **Weather Integration**: Combine disease prediction with weather data

### Blockchain and Smart Contracts

- **Mainnet Deployment**: Transition from testnet to production blockchain
- **Multi-Chain Support**: Deploy on multiple blockchain networks
- **DeFi Integration**: Enable staking and yield farming for insurance pools
- **DAO Governance**: Decentralized governance for policy decisions

### Mobile and User Experience

- **Voice Interface**: Add voice commands in regional languages
- **AR Visualization**: Augmented reality for field-level disease mapping
- **Community Features**: Farmer forums and knowledge sharing
- **Gamification**: Reward farmers for early disease reporting

### Integration and Partnerships

- **PMFBY Integration**: Direct integration with government insurance schemes
- **Bank Integration**: Connect with UPI/DBT for real money transactions
- **IoT Sensors**: Integrate with field sensors for automated monitoring
- **Government Systems**: Connect with agricultural department databases

### Analytics and Insights

- **Predictive Analytics**: Forecast disease outbreaks based on historical data
- **Regional Insights**: Provide region-specific recommendations
- **Yield Prediction**: Estimate crop yields based on disease patterns
- **Carbon Credits**: Track and monetize sustainable farming practices

### Scalability and Performance

- **Edge Computing**: Optimize model for ultra-low-power devices
- **Multi-Language Support**: Add support for all major Indian languages
- **Offline Mode Enhancement**: Improve offline capabilities for remote areas
- **Cloud Infrastructure**: Scale backend to handle millions of users
