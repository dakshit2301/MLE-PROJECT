# Comprehensive Viva Voce Questions & Answers
## Exam Stress & Student Performance Predictor

> **Purpose:** This document provides 52 structured viva questions with clear, simple, and technically rigorous answers designed to help team members confidently defend their Machine Learning PBL project.

---

### Section 1: Dataset & Problem Formulation

#### Q1. Why did you choose this dataset?
**Answer:** We chose the *Student Performance Factors* dataset because it contains 6,607 student records with 19 realistic behavioral, social, and demographic attributes alongside a continuous exam mark (`Exam_Score`). It offers a rich foundation to test regression algorithms and evaluate educational performance drivers without artificial complexity.

#### Q2. Why is the target variable called `Exam_Score` and not CGPA?
**Answer:** The dataset specifically records single examination scores on a 0–100 continuous scale. Calling it CGPA would be inaccurate because CGPA represents a cumulative multi-year grade point average (typically on a 4.0 or 10.0 scale), whereas `Exam_Score` captures performance on an isolated assessment.

#### Q3. Your project title mentions "Exam Stress", but there is no stress column in the dataset. Why?
**Answer:** The raw dataset from Kaggle did not contain a column for stress level or screen time. We openly acknowledge this as a primary limitation. To ethically map to the research objective, we substituted `Motivation_Level` and `Peer_Influence` as behavioral proxies, and stated this adaptation clearly upfront.

#### Q4. What are the key features present in this dataset?
**Answer:** There are 6 continuous numeric features (`Hours_Studied`, `Attendance`, `Sleep_Hours`, `Previous_Scores`, `Tutoring_Sessions`, `Physical_Activity`) and 13 categorical features covering support systems (`Parental_Involvement`, `Access_to_Resources`, `Internet_Access`), school context (`Teacher_Quality`, `School_Type`), and personal factors (`Motivation_Level`, `Gender`, `Learning_Disabilities`).

#### Q5. What is the distribution of the target variable `Exam_Score`?
**Answer:** The target is bell-shaped and approximately normal with a mean of 67.24 marks and a standard deviation of 3.88 marks. Almost all students (98.7%) score between 55 and 78 marks, with a rare, heavy tail reaching up to 100 marks.

---

### Section 2: Data Cleaning & Preprocessing

#### Q6. What invalid data did you find, and how did you handle it?
**Answer:** We found exactly one invalid row where `Exam_Score = 101`. Because exam marks cannot exceed 100 on a 100-point scale, this was an impossible domain error. We removed this single row before any splitting (leaving 6,606 rows), which did not leak test statistics.

#### Q7. Why did you not remove outliers in other features like study hours or sleep?
**Answer:** Outliers in study hours (e.g. 40 hrs/wk) or previous scores are realistic real-world student behaviors, not data entry corruption. Removing extreme but valid observations would artificially inflate model metrics and bias predictions against unusual students.

#### Q8. Why did you NOT impute missing values during data cleaning?
**Answer:** Imputing missing values before splitting calculates statistics across both train and test sets, causing data leakage. To prevent leakage, missing values were kept as `NaN` in `cleaned_dataset.csv` and imputed strictly inside a scikit-learn `Pipeline` fitted on the training split only.

#### Q9. How did you encode categorical variables, and why?
**Answer:** We used `OrdinalEncoder` with explicit, fixed category orderings (e.g. Low $\to$ 0, Medium $\to$ 1, High $\to$ 2). Because all 13 categorical variables represent natural gradations or binary conditions, ordinal encoding maintains compact single-column representations and allows direct interpretation of regression slopes.

#### Q10. Why did you scale numeric features?
**Answer:** Numeric features have different physical units and ranges (e.g., Attendance is 60–100%, Hours_Studied is 1–44 hrs). We used `StandardScaler` to transform features to zero mean and unit variance so that Linear Regression coefficients become directly comparable standardized effect sizes.

---

### Section 3: Data Leakage Prevention

#### Q11. What is data leakage, and why is it dangerous?
**Answer:** Data leakage occurs when information from outside the training dataset (such as test set statistics or future target values) influences the model training process. It leads to unrealistically optimistic validation scores but poor performance when deployed on real unseen data.

#### Q12. How did you ensure zero data leakage in your project?
**Answer:** We followed four strict safeguards: (1) we performed an 80/20 train/test split before computing any statistical transformations; (2) all imputers, encoders, and scalers were wrapped inside a `Pipeline` fitted on training folds only; (3) all feature selection and hyperparameter tuning used training CV only; and (4) `data/test.csv` was opened exactly once at the end of Block 6.

#### Q13. Is using `Previous_Scores` considered target leakage?
**Answer:** No. `Previous_Scores` represents past academic history recorded *prior* to taking the current exam. It is an input feature representing baseline scholastic aptitude, not a proxy or mathematical derivative of the future target `Exam_Score`.

---

### Section 4: Feature Engineering & Selection

#### Q14. What engineered features did you create?
**Answer:** We engineered six domain-motivated features: `Study_x_Attendance` (interaction), `Sleep_Deficit` (hours below 7), `Sleep_Category` (binned sleep duration), `Has_Tutoring` (binary indicator), `Study_per_Sleep` (ratio), and `Active_Total` (physical plus extracurricular activity).

#### Q15. Did you keep the engineered features in the final model? Why or why not?
**Answer:** No, we dropped all six engineered features. In Block 4, cross-validation across three candidate feature sets showed that adding engineered features improved CV $R^2$ by less than 0.0006 (well below our pre-defined threshold of 0.005). Following the scientific principle of parsimony (Occam's razor), we retained original Set A (19 raw features).

---

### Section 5: Machine Learning Models & Cross-Validation

#### Q16. Which four models did you train, and what were their roles?
**Answer:**
1. `DummyRegressor(strategy='mean')`: baseline sanity check (predicts average score).
2. `LinearRegression`: simple, interpretable parametric model.
3. `RandomForestRegressor`: non-linear bagging ensemble of decision trees.
4. `GradientBoostingRegressor`: non-linear sequential boosting ensemble.

#### Q17. What is 5-fold cross-validation, and why did you use it?
**Answer:** In 5-fold CV, the training set (5,284 rows) is partitioned into 5 equal subsets. The model is trained on 4 folds (80%) and evaluated on the remaining fold (20%), repeating 5 times. It provides an unbiased estimate of generalization error and reveals fold-to-fold variance without touching the test set.

#### Q18. How did the Dummy baseline perform, and what does it prove?
**Answer:** The Dummy baseline achieved a CV $R^2$ of $-0.0001$ and MAE of 2.87 marks. An $R^2 \approx 0$ proves that predicting the mean explains none of the variance in marks, establishing that our actual machine learning models (with $R^2 > 0.80$) learn genuine statistical relationships.

#### Q19. How did you tune Random Forest and Gradient Boosting?
**Answer:** We used `GridSearchCV` with 5-fold CV on training data only (`scoring='r2'`, `refit=True`). For Random Forest, we searched 36 combinations across `n_estimators`, `max_depth`, `min_samples_leaf`, and `max_features`. For Gradient Boosting, we searched 27 combinations across `n_estimators`, `learning_rate`, and `max_depth`.

#### Q20. What were the best hyperparameters found?
**Answer:**
- **Random Forest:** `n_estimators = 200`, `max_depth = None`, `max_features = 0.5`, `min_samples_leaf = 1` (improved CV $R^2$ from 0.6213 to 0.6401).
- **Gradient Boosting:** `n_estimators = 300`, `learning_rate = 0.1`, `max_depth = 2` (improved CV $R^2$ from 0.6727 to 0.6977).

---

### Section 6: Evaluation Metrics & Comparison

#### Q21. Explain the four regression metrics: MAE, MSE, RMSE, and $R^2$.
**Answer:**
- **MAE (Mean Absolute Error):** Average absolute difference between actual and predicted marks (in original marks, e.g. 0.41 marks).
- **MSE (Mean Squared Error):** Average squared error; penalizes large blunders heavily.
- **RMSE (Root Mean Squared Error):** Square root of MSE, back in original marks scale (1.52 marks); sensitive to outliers.
- **$R^2$ (Coefficient of Determination):** Proportion of target variance explained by the model ($0 = \text{mean baseline}$, $1 = \text{perfect}$).

#### Q22. What was the performance of your final model on the test set?
**Answer:** Plain Linear Regression achieved:
- **Test $R^2$:** **0.8258** (82.6% of test variance explained)
- **Test MAE:** **0.4103 marks** (average error is just ~0.4 marks)
- **Test RMSE:** **1.5178 marks**
- **Test MSE:** 2.3038

#### Q23. Was the course target of test $R^2 \ge 0.75$ met?
**Answer:** Yes, decisively. The final model achieved a test $R^2$ of **0.8258**, exceeding the 0.75 performance target by +0.0758.

#### Q24. Why did test $R^2$ (0.8258) turn out higher than CV $R^2$ (0.7171)?
**Answer:** This was an artifact of the random 80/20 split. Extreme high-scoring students ($\ge 80$ marks) made up $0.79\%$ of the training set (42 students) but only $0.38\%$ of the test set (5 students). Because extreme scores are hard to predict and contribute 93.39% of squared errors, having fewer outliers in the test split naturally increased test $R^2$.

---

### Section 7: Error Analysis & Model Interpretation

#### Q25. What is a residual, and what is your sign convention?
**Answer:** A residual is defined as $\text{Residual} = \text{Actual} - \text{Predicted}$. A positive residual means the model under-predicted (the student scored higher than expected), while a negative residual means the model over-predicted.

#### Q26. Where did the model make its largest prediction errors?
**Answer:** The largest errors occurred on five students who achieved actual marks $\ge 84$ (scores of 98, 93, 89, 88, 84). The model predicted scores in the 60s and low 70s because their recorded features (e.g. 70% attendance, average study hours) looked completely ordinary.

#### Q27. What is "regression towards the mean" in your residual plot?
**Answer:** Because the vast majority of training data is centered near 67 marks, ordinary linear shrinkage pulls extreme predictions toward the center. Consequently, the model never predicted any test student above 73 marks, leading to large positive residuals for actual scores $\ge 84$.

#### Q28. Did any demographic subgroups exhibit higher error rates?
**Answer:** Yes. Students with `Learning_Disabilities = Yes` showed an MAE of 0.77 marks (+88% above overall average), and students with `Family_Income = High` showed an MAE of 0.52 marks (+27%), reflecting higher unexplained individual score variance in these groups.

#### Q29. Which feature was the single strongest predictor of exam scores?
**Answer:** **Attendance** was unequivocally the strongest predictor across all methods: highest Pearson correlation ($r = 0.58$), largest standardized regression coefficient ($\beta = +2.285$), and highest permutation importance ($\Delta R^2 = 0.8019$).

#### Q30. Which feature was the second strongest predictor?
**Answer:** **Hours_Studied** was the second strongest predictor ($r = 0.45$, $\beta = +1.743$, Permutation $\Delta R^2 = 0.4916$). Each additional standard deviation of study time (~5.6 hrs/wk) is associated with approximately +1.7 marks higher predicted score.

#### Q31. What did you discover about sleep duration (`Sleep_Hours`)?
**Answer:** Sleep hours showed virtually no predictive value ($r = -0.02$, $\beta = -0.012$, Permutation $\Delta R^2 = 0.0000$). In our what-if sensitivity analysis, varying sleep from 5 to 9 hours changed the predicted mark by only 0.03 marks.

#### Q32. What is permutation feature importance, and why is it preferred over tree MDI?
**Answer:** Permutation importance randomly shuffles the values of a single feature on the test set and measures the drop in model $R^2$. Unlike tree Mean Decrease in Impurity (MDI), permutation importance is model-agnostic, computed on unseen data, and does not bias toward continuous features with many split points.

#### Q33. Why must we emphasize that "Correlation $\ne$ Prediction $\ne$ Causation"?
**Answer:** Regression models capture historical statistical associations between survey answers and marks. They do not prove causal mechanisms. For example, high attendance may reflect unmeasured motivation or family discipline; forcing a student to sit in class without engagement will not automatically raise their marks by 2.3 points.

---

### Section 8: Final Model Selection & Demonstration

#### Q34. Why was Linear Regression chosen over Random Forest and Gradient Boosting?
**Answer:** Linear Regression was selected based on four pre-committed criteria: (1) highest cross-validated $R^2$ (0.7171 vs GB 0.6977 and RF 0.6401); (2) lowest CV MAE (0.5062 marks); (3) minimal overfitting gap (RF overfit by 0.31); and (4) maximum transparency and interpretability for educational stakeholders.

#### Q35. How did your interactive demonstration work for unseen students?
**Answer:** We tested three synthetic student profiles: Student A (high engagement) was predicted at 79.1 marks; Student B (average habits, missing Teacher_Quality) was predicted at 66.3 marks; and Student C (low engagement, learning disability) was predicted at 51.9 marks, with an average prediction interval of $\pm 0.4$ marks.

#### Q36. How did your pipeline handle Student B's missing `Teacher_Quality`?
**Answer:** The `SimpleImputer` inside our serialized `final_model.joblib` pipeline automatically recognized the missing value and imputed it with the training set's most frequent category (`Medium`) without causing any execution error.

---

### Section 9: Tricky Viva Questions (Be Prepared!)

#### Q37. Tricky: "In machine learning, advanced ensemble models like Random Forest almost always beat Linear Regression. Why did Linear Regression win here?"
**Answer:** Random Forest excels at discovering complex non-linear thresholds and high-order feature interactions. However, exploratory data analysis showed that this dataset has predominantly additive, linear relationships with Gaussian noise. Linear Regression directly fits this true data-generating process with 19 parameters, whereas Random Forest over-partitions small sample spaces and suffers from tree variance.

#### Q38. Tricky: "Isn't an $R^2$ of 0.83 suspiciously high for educational survey data? Did you leak data?"
**Answer:** An $R^2$ of 0.83 would indeed be unusually high for noisy real-world psychological surveys. However, we proved zero leakage: train/test were split first, transformers were in pipelines, and `test.csv` was read once. The high $R^2$ is primarily due to the synthetic nature of the Kaggle dataset, where scores were generated using smooth linear formulas plus mild Gaussian noise.

#### Q39. Tricky: "If study hours predict marks, why can't a school principal advise students to study 5 more hours to guarantee a grade increase?"
**Answer:** Because our model shows observational association, not experimental causation. Study hours may be a proxy for student diligence, parental pressure, or academic interest. Unless an experimental randomized controlled trial (A/B test) is performed, we cannot prove that increasing hours alone causes higher grades.

#### Q40. Tricky: "Why did you remove only one outlier out of 6,607 rows? Shouldn't you remove all rows outside 3 standard deviations?"
**Answer:** Outlier removal must be scientifically justified. The one row removed had `Exam_Score = 101`, an impossible measurement error on a 100-point scale. Observations with extreme study hours (e.g. 40 hours) or extreme low scores are valid student behaviors. Trimming valid tail observations is bad practice because it artificially inflates test metrics and blinds the model to rare student types.

#### Q41. Tricky: "What would you do if your college asked you to deploy this model tomorrow for actual student admissions?"
**Answer:** We would advise against deploying this model for high-stakes admissions decisions. The dataset appears synthetic, lacks key psychological factors (stress, mental health), does not represent our specific college population, and under-predicts high achievers. It should only be used as a low-stakes advisory prototype.

#### Q42. Tricky: "What is the difference between hyperparameter tuning and model training?"
**Answer:** Model training learns the internal mathematical *parameters* (like weights $\beta$ in Linear Regression or split thresholds in trees) from the data via optimization algorithms. Hyperparameter tuning selects the external architectural *settings* (like tree depth or learning rate) before training begins, using cross-validation to prevent overfitting.

#### Q43. Tricky: "Why did you use K-Fold CV instead of Stratified K-Fold CV?"
**Answer:** Stratified K-Fold is designed for classification tasks to preserve categorical class proportions across folds. Because `Exam_Score` is a continuous regression target, standard randomized `KFold(n_splits=5, shuffle=True, random_state=42)` is the appropriate cross-validation strategy.

#### Q44. Tricky: "What does the RMSE value of 1.52 marks tell you that MAE of 0.41 marks does not?"
**Answer:** MAE gives the typical, median-like error (~0.4 marks). RMSE is sensitive to large deviations because errors are squared before averaging. The fact that RMSE (1.52) is nearly four times larger than MAE (0.41) immediately indicates the presence of a few extreme outliers with very large errors (the 5 students scoring $\ge 84$).

#### Q45. Tricky: "Why didn't you use deep learning or neural networks?"
**Answer:** Neural networks require tens of thousands of complex, multi-modal samples to avoid overfitting and act as black boxes. For a structured tabular dataset of 6,606 rows with predominantly linear relationships, a neural network would add heavy computational overhead and opacity without outperforming an Ordinary Least Squares linear model.

---

### Section 10: Individual Member Contribution Template

*Instructions for team members: Each student should fill out their assigned component below before viva day.*

- **Team Member 1 (`[Name / Roll No]`):** "I led the problem definition, raw data validation, and exploratory data analysis (Blocks 1–3). I established the baseline hypothesis and verified distribution properties."
- **Team Member 2 (`[Name / Roll No]`):** "I was responsible for feature engineering, pipeline construction, ordinal encoding, and data leakage safeguards (Block 4). I ensured all scalers and imputers were fitted only on training data."
- **Team Member 3 (`[Name / Roll No]`):** "I implemented the model training, 5-fold cross-validation, and GridSearchCV hyperparameter tuning for Random Forest and Gradient Boosting (Blocks 5–6)."
- **Team Member 4 (`[Name / Roll No]`):** "I executed the error analysis, permutation feature importance calculations, what-if prediction demonstration, and report compilation (Blocks 7–8)."
