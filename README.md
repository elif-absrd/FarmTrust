# FarmTrust 🌾

A blockchain-based automated insurance and plant disease detection system that empowers Indian farmers with AI-driven diagnostics and transparent, automated insurance payouts.

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

## Installation

### Prerequisites
- Node.js
- npm or yarn
- PostgreSQL
- Python 3.8+ (for ML model training)
- React Native CLI
- MetaMask wallet extension (for blockchain interaction)
- IPFS Desktop or CLI
- Ganache (for local blockchain testing)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/elif-absrd/FarmTrust
cd FarmTrust
```

## Usage

### For Farmers

1. **Register and Onboard**
   - Download the FarmTrust mobile app
   - Create an account with farmer credentials
   - Set up blockchain wallet (guided process)
   - Select crops and purchase insurance policy

2. **Disease Detection**
   - Open the app and select "Scan Plant"
   - Capture clear image of affected leaf
   - Receive instant diagnosis and disease identification
   - View severity level and treatment recommendations

3. **Insurance Claims**
   - If disease severity is high, claim is automatically triggered
   - Track claim status in the app dashboard
   - Receive notification when payout is processed
   - View mock token transfer in wallet

4. **Dashboard and Analytics**
   - Monitor active insurance policies
   - View disease history and trends
   - Access treatment recommendations and best practices
   - Track claim history and payouts

### For Insurance Providers

1. **Policy Management**
   - Create and configure insurance policies
   - Set disease severity thresholds for automatic triggers
   - Define coverage amounts and terms
   - Monitor policy performance

2. **Claim Processing**
   - View automated claims triggered by AI detection
   - Review oracle-verified disease data on blockchain
   - Monitor smart contract executions
   - Access complete audit trail for all transactions

3. **Analytics and Reporting**
   - View disease outbreak patterns across regions
   - Analyze claim statistics and payout trends
   - Generate reports for regulatory compliance
   - Track farmer engagement and app usage

### For Developers/Testers

1. **Local Testing**
   - Use Ganache for local blockchain simulation
   - Test smart contracts with mock accounts
   - Simulate disease detection and payout flow
   - Debug using console logs and transaction traces

2. **Testnet Deployment**
   - Deploy contracts to Polygon Mumbai testnet
   - Request test MATIC tokens from faucet
   - Test with real blockchain but without real funds
   - Validate oracle integration with Chainlink testnet

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

