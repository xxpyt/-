-- Digital bandpass communication simulation database schema
-- For experiment management and thesis traceability

CREATE TABLE project (
  project_id INT PRIMARY KEY AUTO_INCREMENT,
  project_name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_account (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  user_name VARCHAR(50) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'student',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE modulation_type (
  modulation_id INT PRIMARY KEY AUTO_INCREMENT,
  modulation_code VARCHAR(20) NOT NULL UNIQUE,
  modulation_name VARCHAR(50) NOT NULL,
  demod_method VARCHAR(100) NULL
);

CREATE TABLE experiment (
  experiment_id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  modulation_id INT NOT NULL,
  channel_type VARCHAR(20) NOT NULL,
  bit_count INT NOT NULL,
  sample_per_symbol INT NOT NULL,
  run_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255) NULL,
  CONSTRAINT fk_experiment_project FOREIGN KEY (project_id) REFERENCES project(project_id),
  CONSTRAINT fk_experiment_user FOREIGN KEY (user_id) REFERENCES user_account(user_id),
  CONSTRAINT fk_experiment_modulation FOREIGN KEY (modulation_id) REFERENCES modulation_type(modulation_id)
);

CREATE TABLE experiment_config (
  config_id INT PRIMARY KEY AUTO_INCREMENT,
  experiment_id INT NOT NULL UNIQUE,
  carrier_freq FLOAT NOT NULL,
  symbol_rate FLOAT NOT NULL,
  snr_start FLOAT NOT NULL,
  snr_end FLOAT NOT NULL,
  snr_step FLOAT NOT NULL,
  trials INT NOT NULL,
  CONSTRAINT fk_config_experiment FOREIGN KEY (experiment_id) REFERENCES experiment(experiment_id)
);

CREATE TABLE ber_result (
  result_id INT PRIMARY KEY AUTO_INCREMENT,
  experiment_id INT NOT NULL,
  snr_db FLOAT NOT NULL,
  error_bits INT NOT NULL,
  total_bits INT NOT NULL,
  ber_value FLOAT NOT NULL,
  theory_ber FLOAT NULL,
  CONSTRAINT fk_ber_experiment FOREIGN KEY (experiment_id) REFERENCES experiment(experiment_id)
);

CREATE TABLE waveform_file (
  file_id INT PRIMARY KEY AUTO_INCREMENT,
  experiment_id INT NOT NULL,
  file_type VARCHAR(30) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_waveform_experiment FOREIGN KEY (experiment_id) REFERENCES experiment(experiment_id)
);

CREATE INDEX idx_ber_experiment_snr ON ber_result(experiment_id, snr_db);
