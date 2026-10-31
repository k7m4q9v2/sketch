#pragma once
#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <complex>
#include <vector>

namespace luma {
constexpr double pi = 3.14159265358979323846;
inline float clamp(float x, float a, float b) { return std::clamp(x, a, b); }
inline float dbgain(float d) { return std::pow(10.f, d / 20.f); }
enum Param {
    Bank, Patch, AmpOn, AmpA, AmpD, AmpS, AmpR,
    PitchOn, PitchA, PitchD, PitchS, PitchR, PitchAmount,
    OttDepth, OttOut, DelayTime, DelayFeedback, DelayMix,
    EqOn, EqLowFreq, EqLowGain, EqLowQ, EqMidFreq, EqMidGain, EqMidQ,
    EqHighFreq, EqHighGain, EqHighQ, Master, EqLowCut, EqHighCut,
    AmpDelay,AmpHold,AmpCurveA,AmpCurveD,AmpCurveR,PitchDelay,PitchHold,PitchCurveA,PitchCurveD,PitchCurveR,AmpTempo,PitchTempo,
    DelayPan,DelayMode,DelayCut,DelayOffset,DelayDry,ParamCount
};
struct Spec { const char* name; float lo, hi, initial; bool log = false, discrete = false; };
inline constexpr Spec specs[] = {
    {"Bank",0,65535,0,false,true}, {"Patch",0,127,0,false,true},
    {"Amplitude envelope",0,1,1,false,true}, {"Amp attack",0,8,0,true}, {"Amp decay",0,8,0,true},
    {"Amp sustain",0,1,1}, {"Amp release",0,8,0,true},
    {"Pitch envelope",0,1,0,false,true}, {"Pitch attack",0,8,0,true}, {"Pitch decay",0,8,.3f,true},
    {"Pitch sustain",0,1,0}, {"Pitch release",0,8,0,true}, {"Pitch envelope amount",-2400,2400,1200,false,true},
    {"OTT depth",0,1,0}, {"OTT output",-24,12,0}, {"Delay time (1/48 step)",1,768,96,false,true},
    {"Delay feedback",0,1,.3f}, {"Delay input volume",0,1,0}, {"EQ enabled",0,1,1,false,true},
    {"Low frequency",20,20000,120,true}, {"Low gain",-18,18,0}, {"Low Q",.25f,4,.707f,true},
    {"Mid frequency",20,20000,1200,true}, {"Mid gain",-18,18,0}, {"Mid Q",.25f,8,1,true},
    {"High frequency",20,20000,6000,true}, {"High gain",-18,18,0}, {"High Q",.25f,4,.707f,true},
    {"Master gain",-48,6,0}, {"Low cut (48 dB/oct)",0,1,0,false,true}, {"High cut (48 dB/oct)",0,1,0,false,true},
    {"Amp delay",0,4,0,true},{"Amp hold",0,4,0,true},{"Amp attack tension",-1,1,0},{"Amp decay tension",-1,1,0},{"Amp release tension",-1,1,0},
    {"Pitch delay",0,4,0,true},{"Pitch hold",0,4,0,true},{"Pitch attack tension",-1,1,0},{"Pitch decay tension",-1,1,0},{"Pitch release tension",-1,1,0},
    {"Amp tempo sync",0,1,0,false,true},{"Pitch tempo sync",0,1,0,false,true},
    {"Delay input pan",-1,1,0},{"Delay feedback mode",0,2,0,false,true},{"Delay feedback cutoff",100,20000,12000,true},{"Delay stereo offset",-1,1,0},{"Delay dry volume",0,1,1}
};
static_assert(std::size(specs) == ParamCount);
inline float fromNorm(int p, int v) {
    const auto& s = specs[p]; float t = clamp(v / 65536.f, 0, 1);
    float f = s.log ? (s.lo>0?s.lo*std::pow(s.hi/s.lo,t):.001f*std::expm1(t*std::log1p(s.hi/.001f))) : s.lo+(s.hi-s.lo)*t;
    return s.discrete ? std::round(f) : f;
}
inline int toNorm(int p, float f) {
    const auto& s = specs[p]; f = clamp(f,s.lo,s.hi);
    float t = s.log ? (s.lo>0?std::log(f/s.lo)/std::log(s.hi/s.lo):std::log1p(f/.001f)/std::log1p(s.hi/.001f)) : (f-s.lo)/(s.hi-s.lo);
    return std::clamp(int(std::lround(t*65536)),0,65536);
}
struct Parameters {
    std::array<std::atomic<int>, ParamCount> data;
    Parameters() { for(int i=0;i<ParamCount;i++) data[i].store(toNorm(i,specs[i].initial)); }
    float get(int i) const { return fromNorm(i,data[i].load(std::memory_order_relaxed)); }
    int norm(int i) const { return data[i].load(std::memory_order_relaxed); }
    void set(int i,float v) { data[i].store(toNorm(i,v),std::memory_order_relaxed); }
};
struct Envelope {
    float value=0, releaseStart=0, elapsed=0; int stage=0;
    void on() { value=0; elapsed=0; stage=5; }
    void off() { if(stage && stage!=4) { releaseStart=value; elapsed=0; stage=4; } }
    float advance(float dt,float a,float d,float s,float r,float delay=0,float hold=0,float ca=0,float cd=0,float cr=0) {
        elapsed += dt;
        if(stage==5) {value=0;if(elapsed>=delay){elapsed-=delay;stage=1;}}
        if(stage==1) { value=a<=0?1:std::pow(std::min(elapsed/a,1.f),std::exp2(ca*3)); if(elapsed>=a) {elapsed-=a; stage=6;} }
        if(stage==6) {value=1;if(elapsed>=hold){elapsed-=hold;stage=2;}}
        if(stage==2) { value=d<=0?s:s+(1-s)*std::pow(std::max(0.f,1-elapsed/d),std::exp2(cd*3)); if(elapsed>=d) {elapsed=0; stage=3;} }
        if(stage==3) value=s;
        if(stage==4) {value=r<=0?0:releaseStart*std::pow(std::max(0.f,1-elapsed/r),std::exp2(cr*3)); if(elapsed>=r) {stage=0; value=0;} }
        return value;
    }
};
struct Biquad {
    double b0=1,b1=0,b2=0,a1=0,a2=0,z1=0,z2=0;
    void reset() { z1=z2=0; }
    float process(float x) { double y=b0*x+z1; z1=b1*x-a1*y+z2; z2=b2*x-a2*y; return float(y); }
    void peak(double sr,double hz,double gain,double q) {
        hz=std::clamp(hz,10.,sr*.45); double w=2*pi*hz/sr, c=std::cos(w), alpha=std::sin(w)/(2*q), A=std::pow(10.,gain/40), a0=1+alpha/A;
        b0=(1+alpha*A)/a0; b1=-2*c/a0; b2=(1-alpha*A)/a0; a1=-2*c/a0; a2=(1-alpha/A)/a0;
    }
    void cut(double sr,double hz,double q,bool highpass){
        hz=std::clamp(hz,10.,sr*.45);double w=2*pi*hz/sr,c=std::cos(w),alpha=std::sin(w)/(2*q),a0=1+alpha;
        b0=(highpass?(1+c):(1-c))/(2*a0);b1=(highpass?-(1+c):(1-c))/a0;b2=b0;a1=-2*c/a0;a2=(1-alpha)/a0;
    }
    double response(double sr,double hz) const {
        auto z=std::polar(1.,-2*pi*hz/sr); return std::abs((b0+b1*z+b2*z*z)/(1.+a1*z+a2*z*z));
    }
};
inline constexpr float beats[] = {.125f,1.f/6,.1875f,.25f,1.f/3,.375f,.5f,2.f/3,.75f,1.f,1.5f,2.f,4.f};
inline constexpr const wchar_t* beatNames[] = {L"1/32",L"1/16T",L"1/32D",L"1/16",L"1/8T",L"1/16D",L"1/8",L"1/4T",L"1/8D",L"1/4",L"1/4D",L"1/2",L"1/1"};
inline void configureEq(std::array<Biquad,11>& filters,double sr,const Parameters& p){
    bool enabled=p.get(EqOn)>.5f,lo=enabled&&p.get(EqLowCut)>.5f,hi=enabled&&p.get(EqHighCut)>.5f;
    for(int b=0;b<3;b++)filters[b].peak(sr,p.get(EqLowFreq+b*3),enabled&&!(b==0&&lo)&&!(b==2&&hi)?p.get(EqLowGain+b*3):0,p.get(EqLowQ+b*3));
    constexpr double q[]={.5097955791,.6013448869,.8999762231,2.5629154477};
    for(int i=0;i<4;i++){
        if(lo)filters[3+i].cut(sr,p.get(EqLowFreq),q[i],true);else filters[3+i].peak(sr,100,0,1);
        if(hi)filters[7+i].cut(sr,p.get(EqHighFreq),q[i],false);else filters[7+i].peak(sr,1000,0,1);
    }
}
struct Effects {
    double sr=44100;
    std::array<std::array<Biquad,11>,2> eq;
    std::array<std::array<Biquad,2>,2> crossover;
    std::array<float,2> tone{};
    std::array<float,3> detector{};
    std::array<float,3> compressionGain{1,1,1},targetGain{1,1,1},attack{},release{};
    int dynamicsPhase=0;
    std::vector<std::array<float,2>> delay;
    size_t write=0; float delayOld=22050,delayNew=22050,delayFade=1;
    float depth=0,out=1,mix=0,feedback=.3f,master=1,pan=0,offset=0,dryVolume=1;
    void prepare(double rate) {
        sr=rate;delay.assign(size_t(sr*18)+8,{});
        // Complementary residual bands sum exactly to the dry signal. This
        // keeps Depth=0 transparent without a phase-mismatched parallel path.
        for(auto& c:crossover){c[0].cut(sr,90,.7071067812,false);c[1].cut(sr,2500,.7071067812,false);}
        constexpr float attackMs[]={3,1.5f,1},releaseMs[]={160,100,60};
        for(int b=0;b<3;b++){attack[b]=1-std::exp(float(-1000/(attackMs[b]*sr)));release[b]=1-std::exp(float(-1000/(releaseMs[b]*sr)));}
        reset();
    }
    void reset() {
        for(auto& c:eq) for(auto& f:c) f.reset();
        for(auto& c:crossover)for(auto& f:c)f.reset();
        tone={};detector={};compressionGain={1,1,1};targetGain={1,1,1};dynamicsPhase=0;std::fill(delay.begin(),delay.end(),std::array<float,2>{}); write=0;
    }
    static float compressionDb(int band,float db){
        constexpr float below[]={-30,-32,-30},above[]={-20,-22,-20},makeup[]={6,3,6};
        auto knee=[](float x){constexpr float k=6;return x<=-k*.5f?0.f:x>=k*.5f?x:(x+k*.5f)*(x+k*.5f)/(2*k);};
        float up=std::min(36.f,.75f*knee(below[band]-db));
        // Fade upward gain below the noise floor; silence always remains silent.
        up*=clamp((db+100)/24,0,1);
        float down=-.95f*knee(db-above[band]);
        return up+down+makeup[band];
    }
    void update(const Parameters& p, float bpm) {
        for(auto& c:eq)configureEq(c,sr,p);
        float target=clamp(float(sr*60/std::clamp(bpm,20.f,400.f))*p.get(DelayTime)/192.f,1,float(delay.size()-2));
        if(std::abs(target-delayNew)>.5f) { delayOld=delayOld+(delayNew-delayOld)*delayFade; delayNew=target; delayFade=0; }
    }
    std::array<float,2> read(float samples) const {
        double pos=double(write)-samples; if(pos<0) pos+=delay.size(); size_t i=size_t(pos),j=(i+1)%delay.size(); float f=float(pos-i);
        return {delay[i][0]*(1-f)+delay[j][0]*f,delay[i][1]*(1-f)+delay[j][1]*f};
    }
    std::array<float,2> readStereo(float samples,float ofs) const {
        auto l=read(clamp(samples*(1+std::max(0.f,-ofs)*.5f),1,float(delay.size()-2)));
        auto r=read(clamp(samples*(1+std::max(0.f, ofs)*.5f),1,float(delay.size()-2)));return {l[0],r[1]};
    }
    void process(float* interleaved,int frames,const Parameters& p) {
        float smooth=1-std::exp(float(-1/(.01*sr))),gainSmooth=1-std::exp(float(-1/(.002*sr)));
        float td=p.get(OttDepth),to=dbgain(p.get(OttOut)),tm=p.get(DelayMix),tf=p.get(DelayFeedback),tg=dbgain(p.get(Master));
        float tp=p.get(DelayPan),ts=p.get(DelayOffset),tv=p.get(DelayDry),cut=1-std::exp(float(-2*pi*std::min(double(p.get(DelayCut)),sr*.45)/sr));int mode=int(p.get(DelayMode));
        for(int i=0;i<frames;i++) {
            depth+=(td-depth)*smooth; out+=(to-out)*smooth; mix+=(tm-mix)*smooth; feedback+=(tf-feedback)*smooth; master+=(tg-master)*smooth;
            pan+=(tp-pan)*smooth;offset+=(ts-offset)*smooth;dryVolume+=(tv-dryVolume)*smooth;
            float bands[2][3]; float dry[2];
            for(int c=0;c<2;c++) {
                float x=interleaved[i*2+c]; for(auto& f:eq[c]) x=f.process(x);
                dry[c]=x;float lo=crossover[c][0].process(x),hi=crossover[c][1].process(x);
                bands[c][0]=lo;bands[c][1]=hi-lo;bands[c][2]=x-hi;
            }
            float wet[2]={};
            for(int b=0;b<3;b++) {
                float level=std::max(std::abs(bands[0][b]),std::abs(bands[1][b]));
                detector[b]+=(level-detector[b])*(level>detector[b]?attack[b]:release[b]);
                if(dynamicsPhase==0){float db=20*std::log10(std::max(detector[b],1e-10f));targetGain[b]=dbgain(depth*compressionDb(b,db));}
                compressionGain[b]+=(targetGain[b]-compressionGain[b])*gainSmooth;
                for(int c=0;c<2;c++)wet[c]+=bands[c][b]*compressionGain[b];
            }
            dynamicsPhase=(dynamicsPhase+1)&3;
            auto old=readStereo(delayOld,offset), next=readStereo(delayNew,offset);
            delayFade=std::min(1.f,delayFade+float(1/(.025*sr)));
            float delayed[2]={old[0]+(next[0]-old[0])*delayFade,old[1]+(next[1]-old[1])*delayFade};
            float src[2];for(int c=0;c<2;c++)src[c]=(depth<1e-7f&&td==0?dry[c]:wet[c])*out;
            float input[2]={src[0]*(1-std::max(0.f,pan))*mix,src[1]*(1+std::min(0.f,pan))*mix};
            if(mode!=0)std::swap(input[0],input[1]);
            for(int c=0;c<2;c++)tone[c]+=cut*(delayed[c]-tone[c]);
            for(int c=0;c<2;c++) {
                delay[write][c]=clamp(input[c]+tone[mode==2?1-c:c]*feedback,-4,4);
                float y=(src[c]*dryVolume+delayed[c])*master;
                if(!std::isfinite(y)) y=0;
                interleaved[i*2+c]=std::clamp(y,-4.f,4.f);
            }
            write=(write+1)%delay.size();
        }
    }
};
} // namespace luma
