# Answer Sheet Grader

This is a web application designed to help users grade answer sheets by leveraging AI-powered Optical Character Recognition (OCR) to extract the correct answer key from an image, allowing for test simulations and automatic scoring.

## Features

* **Image Upload & AI OCR:** Upload an image of an answer key, and the application uses the Google Gemini AI (via a local proxy backend) to extract question numbers and correct answers.

* **Dynamic Answer Key Review & Editing:**

    * The inferred answer key is displayed, allowing users to review, correct, add, or remove questions and their answers.

    * The application intelligently infers the start and end question numbers from the OCR results, which can be manually adjusted by the user.

* **JSON File Support:**

    * **Save Answer Key:** Export the current, edited answer key to a JSON file for later use.

    * **Load Answer Key:** Load a previously saved JSON answer key, bypassing the image upload and OCR step.

* **Test Simulation:**

    * Enter your answers for the questions based on the loaded answer key.

    * Includes a configurable **countdown timer** for timed test simulations.

* **Automatic Submission:** If the timer runs out, the test is automatically submitted.

* **Score Calculation & Wrong Answers:** After submission, the application calculates the score and highlights incorrect answers, showing both the user's answer and the correct one.

* **Review Section Toggle:** A button to hide/show the "Review/Edit Answer Key" section, useful for maintaining a blind test environment during simulation.

## Technologies Used

* **Frontend:**

    * React.js (with Hooks)

    * HTML5, CSS3

* **Backend (Minimal Proxy):**

    * Node.js

    * Express.js (for simple routing and middleware)

    * `@google/generative-ai` library for interacting with Google Gemini API

    * `multer` (for file uploads if using Express version, or `FileReader` for Base64 in minimal proxy)

    * `cors` (for Cross-Origin Resource Sharing)

    * `dotenv` (for environment variables)

## Setup Instructions

This application consists of two parts: a **Backend Server** (Node.js) and a **Frontend Application** (React.js). Both need to be set up and run separately.

### 1. Obtain Google Gemini API Key

You will need a Google Gemini API key to use the AI OCR feature.

* Go to [Google AI Studio](https://aistudio.google.com/) or [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

* Create a new API key.

### 2. Backend Server Setup

This server acts as a secure proxy to call the Gemini API, keeping your API key safe.

1.  **Clone the Repository:**

    ```
    git clone
2.  **Install Dependencies:**

    ```
    npm install

    ```

3.  **Create `.env` file:**
    In the `answer-sheet-grader-backend` directory, create a file named `.env` and add your Gemini API key:

    ```
    GEMINI_API_KEY=YOUR_YOUR_GEMINI_API_KEY_HERE

    ```

    **IMPORTANT:** Replace `YOUR_YOUR_GEMINI_API_KEY_HERE` with the actual API key you obtained. Do not share this file or commit it to version control.


### 3. Frontend Application Setup

1.  **Create React App (if you haven't already):**

    ```
    npx create-react-app answer-sheet-grader-frontend
    cd answer-sheet-grader-frontend

    ```

2.  **Install dependencies:**

    ```
    npm install

    ```

## How to Run the Application

1.  **Start the Backend Server:**
    Open your terminal, navigate to the `answer-sheet-grader-backend` directory, and run:

    ```
    node server.js

    ```

    You should see a message like `Backend server listening at http://localhost:3001`. Keep this terminal window open.

2.  **Start the Frontend Application:**
    Open a *separate* terminal, navigate to your `answer-sheet-grader-frontend` directory, and run:

    ```
    npm start

    ```

    This will open the React application in your default web browser, usually at `http://localhost:3000/`.

## Usage Guide

1.  **Choose Input Method:**

    * **Upload Image (AI OCR):** Select this option to upload an image of an answer key. The AI will process it to extract the questions and answers.

    * **Load from JSON File:** Select this option to load a previously saved answer key from a `.json` file.

2.  **Process/Load Answer Key:**

    * If "Upload Image" is selected, click "Choose File" and select your answer key image. The application will show a "Processing Image..." message.

    * If "Load from JSON File" is selected, click "Choose File" and select your saved JSON answer key.

3.  **Review/Edit Answer Key:**

    * After processing/loading, the "Review/Edit Answer Key" section will appear.

    * **Inferred Range:** The application will infer the `Start Question` and `End Question` based on the processed data. You can manually adjust these numbers and click "Apply Range" to regenerate the answer key fields.

    * **Edit Answers:** Correct any answers that the AI might have misidentified.

    * **Add/Remove Questions:** Use the "+ Add Single Question" button to add missing questions, or the "x" button next to each question to remove it.

    * **Save as JSON:** Click "Save Answer Key as JSON" to download your current, edited answer key for future use.

    * **Hide Review:** Click the "Hide Review" button to conceal this section, especially useful before starting a test simulation to avoid seeing answers.

4.  **Test Simulation:**

    * Once you are satisfied with the answer key, proceed to the "Test Simulation" section.

    * **Set Duration:** Enter the desired test duration in minutes.

    * **Start Test:** Click "Start Test" to begin the countdown timer.

    * **Enter Answers:** Input your answers (A, B, C, or D) into the respective fields.

    * **Pause/Reset:** You can pause and reset the timer as needed.

    * **Submit Test:** Click "Submit Test" to manually submit your answers, or the test will automatically submit when the timer reaches zero.

5.  **Results:**

    * After submission, the "Results" section will display your score and a list of all incorrect answers, showing your answer versus the correct one.

## Important Notes & Limitations

* **API Key Security:** The Gemini API key is stored and used only on the Node.js backend. **Never expose your API key directly in client-side code in a production environment.**

* **Localhost Only:** This setup is intended for local development and simulation. For a publicly accessible application, you would need to deploy both the backend and frontend to a hosting service.

* **AI Accuracy:** While Gemini AI offers superior OCR, its accuracy can still be affected by image quality (blurry, skewed, low resolution), complex layouts, or unusual fonts. The manual review step is crucial for ensuring the correctness of the answer key.

* **Network Dependency:** The AI OCR feature relies on an active internet connection to communicate with the Gemini API.

* **No Data Persistence (beyond JSON export):** User answers and test results are not saved permanently unless you manually export the answer key to JSON.