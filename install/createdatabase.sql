-- MySQL Script generated by MySQL Workbench
-- 11/23/16 21:28:19
-- Model: New Model    Version: 1.0
-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';

-- -----------------------------------------------------
-- Schema qsaggregator
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema qsaggregator
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `qsaggregator` DEFAULT CHARACTER SET utf8 ;
USE `qsaggregator` ;

-- -----------------------------------------------------
-- Table `qsaggregator`.`weight`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`weight` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`weight` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `time` DATETIME NOT NULL,
  `bmi` DOUBLE UNSIGNED NULL,
  `weight` DOUBLE UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  UNIQUE INDEX `date_UNIQUE` (`time` ASC))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`hr_intraday`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`hr_intraday` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`hr_intraday` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `time` DATETIME NOT NULL,
  `hr` SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  UNIQUE INDEX `time_UNIQUE` (`time` ASC))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`hr_resting`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`hr_resting` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`hr_resting` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `date` DATE NOT NULL,
  `hr` SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  UNIQUE INDEX `date_UNIQUE` (`date` ASC))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`body_fat`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`body_fat` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`body_fat` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `time` DATETIME NOT NULL,
  `fat` DOUBLE UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  UNIQUE INDEX `date_UNIQUE` (`time` ASC))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`sleep`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`sleep` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`sleep` (
  `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `is_main_sleep` TINYINT(1) NOT NULL,
  `efficiency` TINYINT UNSIGNED NOT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `minutes_to_sleep` SMALLINT UNSIGNED NOT NULL,
  `minutes_awake` SMALLINT UNSIGNED NOT NULL,
  `minutes_after_wake` SMALLINT UNSIGNED NOT NULL,
  `awake_count` SMALLINT UNSIGNED NOT NULL,
  `awake_duration` SMALLINT UNSIGNED NOT NULL,
  `restless_count` SMALLINT UNSIGNED NOT NULL,
  `restless_duration` SMALLINT UNSIGNED NOT NULL,
  `minutes_in_bed` SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  UNIQUE INDEX `start_time_UNIQUE` (`start_time` ASC),
  UNIQUE INDEX `end_time_UNIQUE` (`end_time` ASC))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`sleep_states`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`sleep_states` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`sleep_states` (
  `id` TINYINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  UNIQUE INDEX `name_UNIQUE` (`name` ASC))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`sleep_by_minute`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`sleep_by_minute` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`sleep_by_minute` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_sleep` SMALLINT UNSIGNED NOT NULL,
  `id_sleep_states` TINYINT UNSIGNED NOT NULL,
  `time` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  INDEX `id_sleep_idx` (`id_sleep` ASC),
  INDEX `id_sleep_states_idx` (`id_sleep_states` ASC),
  UNIQUE INDEX `time_UNIQUE` (`time` ASC),
  CONSTRAINT `id_sleep`
    FOREIGN KEY (`id_sleep`)
    REFERENCES `qsaggregator`.`sleep` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `id_sleep_states`
    FOREIGN KEY (`id_sleep_states`)
    REFERENCES `qsaggregator`.`sleep_states` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`activity_levels`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`activity_levels` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`activity_levels` (
  `id` TINYINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  UNIQUE INDEX `name_UNIQUE` (`name` ASC))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`activity_intraday`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`activity_intraday` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`activity_intraday` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `time` DATETIME NOT NULL,
  `steps` MEDIUMINT UNSIGNED NOT NULL,
  `distance` DOUBLE UNSIGNED NOT NULL,
  `floors` SMALLINT UNSIGNED NOT NULL,
  `elevation` DOUBLE UNSIGNED NOT NULL,
  `activity_level` TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  INDEX `activity_level_idx` (`activity_level` ASC),
  CONSTRAINT `activity_level`
    FOREIGN KEY (`activity_level`)
    REFERENCES `qsaggregator`.`activity_levels` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `qsaggregator`.`completeness`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `qsaggregator`.`completeness` ;

CREATE TABLE IF NOT EXISTS `qsaggregator`.`completeness` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `table_name` VARCHAR(255) NOT NULL,
  `time` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC),
  UNIQUE INDEX `table_UNIQUE` (`table_name` ASC))
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;


-- -----------------------------------------------------
-- Insert default values
-- -----------------------------------------------------
INSERT INTO `activity_levels` (`id`, `name`) VALUES
(0, 'sedentary'),
(1, 'lightly active'),
(2, 'fairly active'),
(3, 'very active');

INSERT INTO `completeness` (`table_name`, `time`) VALUES
('activity_intraday', NULL),
('body_fat', NULL),
('hr_intraday', NULL),
('sleep', NULL),
('weight', NULL);

INSERT INTO `sleep_states` (`id`, `name`) VALUES
(1, 'asleep'),
(2, 'awake'),
(3, 'really awake');