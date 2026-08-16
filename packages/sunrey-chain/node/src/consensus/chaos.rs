//! Development chaos controls. No external paid infrastructure.

use super::simnet::SimNet;
use super::validators::ValidatorId;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChaosAction {
    KillValidator,
    DisconnectPeer,
    DelayPackets,
    DropPackets,
    DuplicatePackets,
    RestartNode,
    PauseNode,
}

pub struct ChaosController<'a> {
    pub net: &'a mut SimNet,
}

impl<'a> ChaosController<'a> {
    pub fn new(net: &'a mut SimNet) -> Self {
        Self { net }
    }

    pub fn kill_validator(&mut self, name: &str) {
        self.net.set_online(name, false);
    }

    pub fn restart_node(&mut self, name: &str, fixture: &super::fixture::FourValidatorFixture) {
        self.net.restart(name, fixture);
    }

    pub fn pause_node(&mut self, name: &str) {
        self.net.pause(name, true);
    }

    pub fn resume_node(&mut self, name: &str) {
        self.net.pause(name, false);
    }

    pub fn disconnect_peer(&mut self, a: &str, b: &str) {
        self.net.drop_path(a, b);
        self.net.drop_path(b, a);
    }

    pub fn delay_packets(&mut self, from: &str, to: &str, ticks: u32) {
        self.net.delay_path(from, to, ticks);
    }

    pub fn drop_packets(&mut self, from: &str, to: &str) {
        self.net.drop_path(from, to);
    }

    pub fn duplicate_packets(&mut self, from: &str, to: &str) {
        self.net.duplicate_path(from, to);
    }

    pub fn supported() -> [ChaosAction; 7] {
        [
            ChaosAction::KillValidator,
            ChaosAction::DisconnectPeer,
            ChaosAction::DelayPackets,
            ChaosAction::DropPackets,
            ChaosAction::DuplicatePackets,
            ChaosAction::RestartNode,
            ChaosAction::PauseNode,
        ]
    }
}

pub fn isolated(id: ValidatorId) -> ValidatorId {
    id
}
