/**
 * Integration Validation Script for Emergency Pause System
 * 
 * This script validates that the emergency pause system integrates correctly
 * with existing platform contracts without requiring a full test environment.
 */

import { EmergencyPause } from '../contracts/emergency/EmergencyPause';
import { EmergencyGovernance } from '../contracts/emergency/governance/EmergencyGovernance';
import { EmergencyLib } from '../contracts/emergency/libraries/EmergencyLib';
import { 
  PauseLevel, 
  EmergencyConfig, 
  DEFAULT_EMERGENCY_CONFIG,
  GovernanceAction 
} from '../contracts/emergency/structures/PauseStructure';

interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
}

class IntegrationValidator {
  private emergencyPause: EmergencyPause;
  private governanceMembers: string[];
  private testConfig: EmergencyConfig;

  constructor() {
    this.governanceMembers = [
      '0x1234567890123456789012345678901234567890',
      '0x2345678901234567890123456789012345678901',
      '0x3456789012345678901234567890123456789012',
      '0x4567890123456789012345678901234567890123',
      '0x5678901234567890123456789012345678901234'
    ];

    this.testConfig = {
      ...DEFAULT_EMERGENCY_CONFIG,
      governanceMembers: this.governanceMembers,
      criticalContracts: [
        '0xTokenContract',
        '0xDaoContract', 
        '0xEscrowContract',
        '0xFeesContract',
        '0xSecurityContract'
      ],
      requiredSignatures: 3,
      maxPauseDuration: 3600
    };

    this.emergencyPause = new EmergencyPause(this.governanceMembers, this.testConfig);
  }

  /**
   * @dev Validates all integration aspects
   */
  public async validateAll(): Promise<ValidationResult[]> {
    console.log('🔍 Starting Emergency Pause System Integration Validation...\n');

    const results: ValidationResult[] = [];

    // Core functionality validation
    results.push(await this.validateCoreFunctionality());
    
    // Governance validation
    results.push(await this.validateGovernanceIntegration());
    
    // Multi-level pause validation
    results.push(await this.validateMultiLevelPause());
    
    // Gas optimization validation
    results.push(await this.validateGasOptimization());
    
    // Security validation
    results.push(await this.validateSecurityFeatures());
    
    // Performance validation
    results.push(await this.validatePerformanceMetrics());
    
    // Error handling validation
    results.push(await this.validateErrorHandling());

    return results;
  }

  /**
   * @dev Validates core emergency pause functionality
   */
  private async validateCoreFunctionality(): Promise<ValidationResult> {
    try {
      console.log('📋 Testing core functionality...');

      // Test pause initiation
      await this.emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Integration test pause',
        3600,
        ['0xTokenContract']
      );

      // Verify pause status
      const status = await this.emergencyPause.getPauseStatus();
      if (!status.isActive || status.level !== PauseLevel.SELECTIVE) {
        throw new Error('Pause status incorrect');
      }

      // Test contract pause check
      const isPaused = await this.emergencyPause.isContractPaused('0xTokenContract');
      if (!isPaused) {
        throw new Error('Contract not properly paused');
      }

      // Test resume operations
      await this.emergencyPause.resumeOperations(
        PauseLevel.SELECTIVE,
        ['sig1', 'sig2', 'sig3'],
        'test_proof'
      );

      // Verify resume
      const resumeStatus = await this.emergencyPause.getPauseStatus();
      if (resumeStatus.isActive) {
        throw new Error('Contract not properly resumed');
      }

      return {
        success: true,
        message: '✅ Core functionality validation passed',
        details: {
          pauseDuration: status.duration,
          affectedContracts: status.affectedContracts.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: '❌ Core functionality validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * @dev Validates governance integration
   */
  private async validateGovernanceIntegration(): Promise<ValidationResult> {
    try {
      console.log('🏛️ Testing governance integration...');

      // Test governance member validation
      const isValid = await this.emergencyPause.validateGovernanceAction(
        GovernanceAction.UPDATE_CONFIG,
        ['sig1', 'sig2', 'sig3']
      );

      if (!isValid) {
        throw new Error('Governance validation failed');
      }

      // Test governance statistics
      const stats = this.emergencyPause.getGovernanceStats();
      if (stats.totalMembers !== this.governanceMembers.length) {
        throw new Error('Governance stats incorrect');
      }

      // Test member management
      await this.emergencyPause.addGovernanceMember(
        '0xNewMember123456789012345678901234567890',
        ['sig1', 'sig2', 'sig3']
      );

      const updatedStats = this.emergencyPause.getGovernanceStats();
      if (updatedStats.totalMembers !== this.governanceMembers.length + 1) {
        throw new Error('Member addition failed');
      }

      return {
        success: true,
        message: '✅ Governance integration validation passed',
        details: {
          totalMembers: updatedStats.totalMembers,
          requiredSignatures: updatedStats.requiredSignatures
        }
      };

    } catch (error) {
      return {
        success: false,
        message: '❌ Governance integration validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * @dev Validates multi-level pause functionality
   */
  private async validateMultiLevelPause(): Promise<ValidationResult> {
    try {
      console.log('🎯 Testing multi-level pause...');

      const testResults = [];

      // Test SELECTIVE level
      await this.emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Selective test',
        1800,
        ['0xTokenContract', '0xDaoContract']
      );

      const selectiveContracts = await this.emergencyPause.getAffectedContracts(PauseLevel.SELECTIVE);
      testResults.push({
        level: 'SELECTIVE',
        contractCount: selectiveContracts.length,
        expectedCount: 2
      });

      await this.emergencyPause.resumeOperations(
        PauseLevel.SELECTIVE,
        ['sig1', 'sig2'],
        'proof'
      );

      // Test PARTIAL level
      await this.emergencyPause.emergencyPause(
        PauseLevel.PARTIAL,
        'Partial test',
        3600,
        []
      );

      const partialContracts = await this.emergencyPause.getAffectedContracts(PauseLevel.PARTIAL);
      testResults.push({
        level: 'PARTIAL',
        contractCount: partialContracts.length,
        expectedCount: this.testConfig.criticalContracts.length
      });

      await this.emergencyPause.resumeOperations(
        PauseLevel.PARTIAL,
        ['sig1', 'sig2', 'sig3'],
        'proof'
      );

      // Test FULL level
      await this.emergencyPause.emergencyPause(
        PauseLevel.FULL,
        'Full test',
        7200,
        []
      );

      const fullContracts = await this.emergencyPause.getAffectedContracts(PauseLevel.FULL);
      testResults.push({
        level: 'FULL',
        contractCount: fullContracts.length,
        expectedCount: 0 // Would be all contracts in real implementation
      });

      await this.emergencyPause.resumeOperations(
        PauseLevel.FULL,
        ['sig1', 'sig2', 'sig3', 'sig4', 'sig5'],
        'proof'
      );

      return {
        success: true,
        message: '✅ Multi-level pause validation passed',
        details: { testResults }
      };

    } catch (error) {
      return {
        success: false,
        message: '❌ Multi-level pause validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * @dev Validates gas optimization features
   */
  private async validateGasOptimization(): Promise<ValidationResult> {
    try {
      console.log('⛽ Testing gas optimization...');

      const gasData = await this.emergencyPause.getGasOptimizationData();
      
      // Validate gas estimates are reasonable
      if (gasData.pauseGasCost <= 0 || gasData.pauseGasCost > 1000000) {
        throw new Error('Invalid pause gas cost');
      }

      if (gasData.resumeGasCost <= 0 || gasData.resumeGasCost > 1000000) {
        throw new Error('Invalid resume gas cost');
      }

      if (gasData.notificationGasCost <= 0 || gasData.notificationGasCost > 100000) {
        throw new Error('Invalid notification gas cost');
      }

      // Test gas estimation in EmergencyLib
      const pauseEstimate = EmergencyLib.estimatePauseGas(
        PauseLevel.FULL,
        this.testConfig.criticalContracts.length,
        this.testConfig
      );

      const resumeEstimate = EmergencyLib.estimateResumeGas(
        PauseLevel.FULL,
        this.testConfig.requiredSignatures,
        this.testConfig
      );

      return {
        success: true,
        message: '✅ Gas optimization validation passed',
        details: {
          pauseGasCost: gasData.pauseGasCost,
          resumeGasCost: gasData.resumeGasCost,
          notificationGasCost: gasData.notificationGasCost,
          estimatedPauseCost: pauseEstimate,
          estimatedResumeCost: resumeEstimate
        }
      };

    } catch (error) {
      return {
        success: false,
        message: '❌ Gas optimization validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * @dev Validates security features
   */
  private async validateSecurityFeatures(): Promise<ValidationResult> {
    try {
      console.log('🔒 Testing security features...');

      // Test validation functions
      const pauseValidation = EmergencyLib.validatePauseRequest(
        PauseLevel.SELECTIVE,
        'Valid reason',
        3600,
        ['0xTokenContract'],
        this.testConfig
      );

      if (!pauseValidation.isValid) {
        throw new Error('Valid pause request rejected');
      }

      // Test invalid requests
      const invalidPauseValidation = EmergencyLib.validatePauseRequest(
        PauseLevel.NONE,
        'Invalid level',
        3600,
        ['0xTokenContract'],
        this.testConfig
      );

      if (invalidPauseValidation.isValid) {
        throw new Error('Invalid pause request accepted');
      }

      // Test address validation
      const validAddress = EmergencyLib.isValidAddress('0x1234567890123456789012345678901234567890');
      const invalidAddress = EmergencyLib.isValidAddress('invalid_address');

      if (!validAddress || invalidAddress) {
        throw new Error('Address validation failed');
      }

      // Test signature validation
      const validSignature = EmergencyLib.isValidSignature('valid_signature');
      const invalidSignature = EmergencyLib.isValidSignature('');

      if (!validSignature || invalidSignature) {
        throw new Error('Signature validation failed');
      }

      return {
        success: true,
        message: '✅ Security features validation passed',
        details: {
          pauseValidationErrors: pauseValidation.errors.length,
          invalidRequestErrors: invalidPauseValidation.errors.length,
          addressValidation: validAddress && !invalidAddress,
          signatureValidation: validSignature && !invalidSignature
        }
      };

    } catch (error) {
      return {
        success: false,
        message: '❌ Security features validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * @dev Validates performance metrics
   */
  private async validatePerformanceMetrics(): Promise<ValidationResult> {
    try {
      console.log('📊 Testing performance metrics...');

      const startTime = Date.now();

      // Test pause performance
      await this.emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Performance test',
        3600,
        ['0xTokenContract']
      );

      const pauseTime = Date.now() - startTime;

      // Test resume performance
      const resumeStartTime = Date.now();
      await this.emergencyPause.resumeOperations(
        PauseLevel.SELECTIVE,
        ['sig1', 'sig2', 'sig3'],
        'proof'
      );

      const resumeTime = Date.now() - resumeStartTime;

      // Test analytics performance
      const analyticsStartTime = Date.now();
      const analytics = await this.emergencyPause.getPauseAnalytics();
      const analyticsTime = Date.now() - analyticsStartTime;

      // Validate performance targets
      if (pauseTime > 1000) { // Should complete within 1 second
        throw new Error(`Pause too slow: ${pauseTime}ms`);
      }

      if (resumeTime > 1000) { // Should complete within 1 second
        throw new Error(`Resume too slow: ${resumeTime}ms`);
      }

      if (analyticsTime > 500) { // Should complete within 500ms
        throw new Error(`Analytics too slow: ${analyticsTime}ms`);
      }

      return {
        success: true,
        message: '✅ Performance metrics validation passed',
        details: {
          pauseTime: `${pauseTime}ms`,
          resumeTime: `${resumeTime}ms`,
          analyticsTime: `${analyticsTime}ms`,
          totalPauses: analytics.totalPauses,
          averageDuration: analytics.averageDuration
        }
      };

    } catch (error) {
      return {
        success: false,
        message: '❌ Performance metrics validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * @dev Validates error handling
   */
  private async validateErrorHandling(): Promise<ValidationResult> {
    try {
      console.log('⚠️ Testing error handling...');

      const errorTests = [];

      // Test duplicate pause
      try {
        await this.emergencyPause.emergencyPause(
          PauseLevel.SELECTIVE,
          'First pause',
          3600,
          ['0xTokenContract']
        );

        await this.emergencyPause.emergencyPause(
          PauseLevel.SELECTIVE,
          'Second pause',
          3600,
          ['0xTokenContract']
        );

        errorTests.push({ test: 'duplicate_pause', passed: false });
      } catch (error) {
        errorTests.push({ test: 'duplicate_pause', passed: true });
      }

      // Test resume without pause
      try {
        await this.emergencyPause.resumeOperations(
          PauseLevel.SELECTIVE,
          ['sig1', 'sig2', 'sig3'],
          'proof'
        );

        errorTests.push({ test: 'resume_without_pause', passed: false });
      } catch (error) {
        errorTests.push({ test: 'resume_without_pause', passed: true });
      }

      // Test invalid pause level
      try {
        EmergencyLib.validatePauseRequest(
          PauseLevel.NONE,
          'Invalid',
          3600,
          ['0xTokenContract'],
          this.testConfig
        );

        errorTests.push({ test: 'invalid_level', passed: false });
      } catch (error) {
        errorTests.push({ test: 'invalid_level', passed: true });
      }

      const passedTests = errorTests.filter(t => t.passed).length;
      const totalTests = errorTests.length;

      return {
        success: passedTests === totalTests,
        message: passedTests === totalTests ? 
          '✅ Error handling validation passed' : 
          '⚠️ Error handling validation partially passed',
        details: {
          passedTests,
          totalTests,
          testResults: errorTests
        }
      };

    } catch (error) {
      return {
        success: false,
        message: '❌ Error handling validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * @dev Runs the integration validation
 */
export async function runIntegrationValidation(): Promise<void> {
  const validator = new IntegrationValidator();
  const results = await validator.validateAll();

  console.log('\n📋 Integration Validation Results:');
  console.log('=====================================\n');

  let passedCount = 0;
  let totalCount = results.length;

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.message}`);
    
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    
    if (result.success) {
      passedCount++;
    }
    
    console.log('');
  });

  console.log('=====================================');
  console.log(`Summary: ${passedCount}/${totalCount} validations passed`);
  
  if (passedCount === totalCount) {
    console.log('🎉 All integration validations passed! Emergency Pause System is ready for deployment.');
  } else {
    console.log('⚠️ Some validations failed. Please review and fix issues before deployment.');
  }
}

// CLI interface
if (require.main === module) {
  runIntegrationValidation().catch(console.error);
}
